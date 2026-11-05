-- Schéma complet pour une installation NEUVE.
-- À coller dans l'éditeur SQL de Supabase (Dashboard > SQL Editor > New query).
-- Si tes tables existent déjà, n'exécute pas ce fichier : utilise les
-- migrations (voir README).

-- ============================================================================
-- Tables
-- ============================================================================

-- Catalogue global des séries. Une ligne par série, partagée par tous les
-- utilisateurs qui la suivent : elle n'est scrapée qu'une fois par run.
create table if not exists animes (
  id uuid primary key default gen_random_uuid(),
  -- Chemin relatif seulement, ex: "/anime/wandance/". Pas l'URL complète : le
  -- domaine de voiranime change souvent, il est reconstruit au scraping à
  -- partir de la variable d'env BASE_URL.
  path text not null unique
    constraint animes_path_format check (path ~ '^/anime/[^/]+/$' and char_length(path) <= 200),
  title text, -- récupéré automatiquement au premier scraping
  poster_url text, -- affiche, récupérée automatiquement au scraping
  -- false = le prochain scraping archive les épisodes existants sans notifier
  -- (évite le spam quand on ajoute une série qui a déjà 1000 épisodes)
  initial_scrape_done boolean not null default false,
  last_scraped_at timestamptz,
  last_error text, -- null si le dernier scraping a réussi
  created_at timestamptz not null default now()
);

-- Qui suit quoi.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references animes(id) on delete cascade,
  active boolean not null default true, -- false = en pause, pas de notif
  created_at timestamptz not null default now(),
  unique (user_id, anime_id)
);

create table if not exists episodes_notified (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid references animes(id) on delete cascade,
  -- Chemin de l'épisode, sans le domaine (sinon un changement de domaine de
  -- voiranime ferait passer tous les épisodes pour nouveaux).
  episode_id text not null unique,
  title text,
  link text,
  description text,
  is_backlog boolean not null default false, -- true = archivé au premier scraping, jamais notifié
  discovered_at timestamptz not null default now()
);

-- Salons Discord (webhooks) de chaque utilisateur.
create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'discord',
  config jsonb not null, -- {"webhook_url": "https://discord.com/api/webhooks/..."}
  label text,
  active boolean not null default true, -- passé à false si le webhook est supprimé côté Discord
  created_at timestamptz not null default now(),
  constraint notification_channels_discord_webhook check (
    type = 'discord'
    and config->>'webhook_url' ~ '^https://(ptb\.|canary\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
    and octet_length(config::text) <= 500
  ),
  constraint notification_channels_label_length check (label is null or char_length(label) <= 100)
);

-- Suivi de santé du scraper (une seule ligne, id = 1) : sert à alerter
-- l'admin quand tout échoue plusieurs runs d'affilée ou que le domaine change.
create table if not exists scraper_health (
  id int primary key default 1 check (id = 1),
  consecutive_full_failures int not null default 0,
  last_failure_alert_at timestamptz,
  last_redirect_alert_host text,
  last_redirect_alert_at timestamptz
);

insert into scraper_health (id) values (1) on conflict (id) do nothing;

create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_anime_active on subscriptions(anime_id) where active;
create index if not exists idx_episodes_anime_discovered on episodes_notified(anime_id, discovered_at desc);
create unique index if not exists idx_channels_user_webhook on notification_channels(user_id, (config->>'webhook_url'));

-- ============================================================================
-- Limites et règles métier (triggers)
-- ============================================================================

-- Max 100 séries par compte : le scraper attend 2 s entre chaque page, il ne
-- faut pas qu'un seul compte puisse le ralentir pour tout le monde.
create or replace function public.enforce_subscription_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.subscriptions where user_id = new.user_id) >= 100 then
    raise exception 'subscription_limit';
  end if;
  return new;
end $$;

drop trigger if exists subscriptions_limit on subscriptions;
create trigger subscriptions_limit before insert on subscriptions
  for each row execute function public.enforce_subscription_limit();

-- Max 5 salons Discord par compte.
create or replace function public.enforce_channel_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.notification_channels where user_id = new.user_id) >= 5 then
    raise exception 'channel_limit';
  end if;
  return new;
end $$;

drop trigger if exists notification_channels_limit on notification_channels;
create trigger notification_channels_limit before insert on notification_channels
  for each row execute function public.enforce_channel_limit();

-- Une série que plus personne ne suit n'est plus scrapée. Si quelqu'un la
-- (re)suit des mois plus tard, tous les épisodes sortis entre-temps passeraient
-- pour nouveaux : on relance donc une première analyse silencieuse.
create or replace function public.reset_initial_scrape_if_unwatched()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    if not exists (
      select 1 from public.subscriptions s
      where s.anime_id = new.anime_id and s.active and s.id <> new.id
    ) then
      update public.animes set initial_scrape_done = false where id = new.anime_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists subscriptions_reset_initial_scrape on subscriptions;
create trigger subscriptions_reset_initial_scrape after insert or update of active on subscriptions
  for each row execute function public.reset_initial_scrape_if_unwatched();

-- ============================================================================
-- Sécurité : Row Level Security
-- L'app web utilise la clé anon + la session de l'utilisateur : ces règles
-- garantissent que chacun ne voit et ne modifie que ses propres données.
-- Le scraper utilise la clé service_role, qui contourne ces règles.
-- ============================================================================

alter table animes enable row level security;
alter table subscriptions enable row level security;
alter table episodes_notified enable row level security;
alter table notification_channels enable row level security;
alter table scraper_health enable row level security; -- aucune règle = service_role uniquement

-- Le catalogue et les épisodes sont des infos publiques : lisibles par tout compte connecté.
-- Pas d'écriture directe : ajout via follow_anime(), mise à jour par le scraper.
drop policy if exists "animes_select" on animes;
create policy "animes_select" on animes for select to authenticated using (true);

drop policy if exists "episodes_select" on episodes_notified;
create policy "episodes_select" on episodes_notified for select to authenticated using (true);

-- Abonnements : lecture / pause / suppression des siens. Pas d'insert direct
-- (passe par follow_anime(), qui crée la série au besoin).
drop policy if exists "subscriptions_select_own" on subscriptions;
create policy "subscriptions_select_own" on subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "subscriptions_update_own" on subscriptions;
create policy "subscriptions_update_own" on subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "subscriptions_delete_own" on subscriptions;
create policy "subscriptions_delete_own" on subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Salons : gestion complète des siens.
drop policy if exists "channels_select_own" on notification_channels;
create policy "channels_select_own" on notification_channels for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "channels_insert_own" on notification_channels;
create policy "channels_insert_own" on notification_channels for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "channels_update_own" on notification_channels;
create policy "channels_update_own" on notification_channels for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "channels_delete_own" on notification_channels;
create policy "channels_delete_own" on notification_channels for delete to authenticated
  using ((select auth.uid()) = user_id);

-- En plus des règles ci-dessus, un utilisateur ne peut modifier que ces colonnes.
revoke update on subscriptions from anon, authenticated;
grant update (active) on subscriptions to authenticated;
revoke update on notification_channels from anon, authenticated;
grant update (active, label) on notification_channels to authenticated;

-- ============================================================================
-- Fonctions appelées par l'app web (supabase.rpc)
-- ============================================================================

-- Suit une série : la crée dans le catalogue si besoin, puis l'abonne.
-- Renvoie 'added' ou 'already_following'.
create or replace function public.follow_anime(p_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_anime uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_path is null or p_path !~ '^/anime/[^/]+/$' or char_length(p_path) > 200 then
    raise exception 'invalid_path';
  end if;

  insert into public.animes (path) values (p_path) on conflict (path) do nothing;
  select id into v_anime from public.animes where path = p_path;

  if exists (select 1 from public.subscriptions where user_id = v_user and anime_id = v_anime) then
    return 'already_following';
  end if;

  insert into public.subscriptions (user_id, anime_id) values (v_user, v_anime);
  return 'added';
end $$;

-- Supprime le compte de l'utilisateur connecté (ses abonnements et salons
-- partent en cascade).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.follow_anime(text) from public, anon;
grant execute on function public.follow_anime(text) to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
