-- Passage du site en multi-utilisateur (comptes Discord, un catalogue de
-- séries partagé, des salons Discord par utilisateur, Row Level Security).
--
-- À exécuter UNE SEULE FOIS, sur une base déjà à jour des migrations 001 et 002.
--   1. Connecte-toi une première fois au nouveau site avec Discord : ça crée ton compte.
--   2. Remplace l'email de la ligne marquée ⬅️ ci-dessous par celui de ce
--      compte (visible dans Supabase > Authentication > Users).
--   3. Colle tout dans SQL Editor > New query > Run.
-- Tes séries et ton webhook actuels sont rattachés à ce compte. Si quelque
-- chose échoue, rien n'est modifié (tout est dans une transaction).

begin;

create temp table _owner on commit drop as
  select id from auth.users
  where email = 'ton.email@exemple.com'; -- ⬅️ REMPLACE PAR L'EMAIL DE TON COMPTE

do $$
begin
  if (select count(*) from _owner) <> 1 then
    raise exception 'Aucun compte trouvé avec cet email. Connecte-toi d''abord au site avec Discord, puis mets à la ligne marquée ⬅️ l''email affiché dans Authentication > Users.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. watchlist_items devient le catalogue global "animes"
-- ----------------------------------------------------------------------------
alter table watchlist_items rename to animes;
alter table animes add column if not exists last_scraped_at timestamptz;
alter table animes add column if not exists last_error text;
-- "not valid" : la règle s'applique aux nouvelles séries sans bloquer sur les anciennes.
alter table animes add constraint animes_path_format
  check (path ~ '^/anime/[^/]+/$' and char_length(path) <= 200) not valid;

alter table episodes_notified rename column watchlist_item_id to anime_id;
alter table episodes_notified add column if not exists is_backlog boolean not null default false;

drop index if exists idx_watchlist_active;
drop index if exists idx_episodes_item;
drop index if exists idx_episodes_discovered;

-- ----------------------------------------------------------------------------
-- 2. Abonnements : tes séries actuelles deviennent les tiennes
-- ----------------------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references animes(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, anime_id)
);

insert into subscriptions (user_id, anime_id, active, created_at)
  select (select id from _owner), id, active, created_at from animes;

alter table animes drop column user_id;
alter table animes drop column active;

-- ----------------------------------------------------------------------------
-- 3. Salons Discord : ton webhook actuel devient le tien
-- ----------------------------------------------------------------------------
update notification_channels set user_id = (select id from _owner);
alter table notification_channels alter column user_id drop default;
alter table notification_channels add column if not exists label text;
alter table notification_channels add column if not exists created_at timestamptz not null default now();
alter table notification_channels
  add constraint notification_channels_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint notification_channels_discord_webhook check (
    type = 'discord'
    and config->>'webhook_url' ~ '^https://(ptb\.|canary\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
    and octet_length(config::text) <= 500
  ),
  add constraint notification_channels_label_length check (label is null or char_length(label) <= 100);

-- ----------------------------------------------------------------------------
-- 4. Épisodes : on retire le domaine des identifiants (sinon un changement de
--    domaine de voiranime ferait passer tous les épisodes pour nouveaux)
-- ----------------------------------------------------------------------------
create function pg_temp.episode_path(t text) returns text language sql immutable as $$
  select case
    when t ~ '^https?://' then
      regexp_replace(regexp_replace(regexp_replace(t, '^https?://[^/]+', ''), '[?#].*$', ''), '/?$', '/')
    else t
  end
$$;

-- Si un même épisode a été enregistré sous deux domaines, on garde le plus ancien.
delete from episodes_notified a
using episodes_notified b
where a.id <> b.id
  and pg_temp.episode_path(a.episode_id) = pg_temp.episode_path(b.episode_id)
  and (a.discovered_at, a.id) > (b.discovered_at, b.id);

update episodes_notified
set episode_id = pg_temp.episode_path(episode_id)
where episode_id ~ '^https?://';

-- ----------------------------------------------------------------------------
-- 5. Index
-- ----------------------------------------------------------------------------
create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_anime_active on subscriptions(anime_id) where active;
create index if not exists idx_episodes_anime_discovered on episodes_notified(anime_id, discovered_at desc);
create unique index if not exists idx_channels_user_webhook on notification_channels(user_id, (config->>'webhook_url'));

-- ----------------------------------------------------------------------------
-- 6. Limites, triggers, Row Level Security et fonctions (identique à schema.sql)
-- ----------------------------------------------------------------------------

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

commit;
