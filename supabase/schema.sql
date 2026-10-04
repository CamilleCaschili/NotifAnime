-- À coller dans l'éditeur SQL de Supabase (Dashboard > SQL Editor > New query)

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000000',
  path text not null unique, -- chemin relatif seulement, ex: "/anime/wandance/"
  -- (pas l'URL complète : le domaine de voiranime change souvent, il est
  -- reconstruit à chaque scraping à partir de la variable d'env BASE_URL)
  title text,
  poster_url text, -- affiche de la série, récupérée automatiquement au scraping
  initial_scrape_done boolean not null default false, -- false = le prochain scraping
  -- archive les épisodes existants sans notifier (évite le spam à l'ajout d'une série)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists episodes_notified (
  id uuid primary key default gen_random_uuid(),
  watchlist_item_id uuid references watchlist_items(id) on delete cascade,
  episode_id text not null unique, -- équivalent de l'ancien "seen id" (souvent l'URL de l'épisode)
  title text,
  link text,
  description text,
  discovered_at timestamptz not null default now()
);

create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000000',
  type text not null default 'discord', -- 'discord' | 'telegram' | 'mail' (plus tard)
  config jsonb not null, -- ex: {"webhook_url": "https://discord.com/api/webhooks/..."}
  active boolean not null default true
);

-- Suivi de santé du scraper (une seule ligne, id = 1) : sert à alerter sur
-- Discord quand tout échoue plusieurs runs d'affilée ou que le domaine change.
create table if not exists scraper_health (
  id int primary key default 1 check (id = 1),
  consecutive_full_failures int not null default 0,
  last_failure_alert_at timestamptz,
  last_redirect_alert_host text,
  last_redirect_alert_at timestamptz
);

insert into scraper_health (id) values (1) on conflict (id) do nothing;

-- Index utiles pour les lectures fréquentes du scraper et de l'app web
create index if not exists idx_watchlist_active on watchlist_items(active);
create index if not exists idx_episodes_item on episodes_notified(watchlist_item_id);
create index if not exists idx_episodes_discovered on episodes_notified(discovered_at desc);

-- Note : user_id a une valeur par défaut fixe pour l'instant (pas d'auth).
-- Le jour où tu actives Supabase Auth, tu changeras le default et tu backfilleras
-- les lignes existantes avec ton propre user_id — pas de migration de structure à refaire.
