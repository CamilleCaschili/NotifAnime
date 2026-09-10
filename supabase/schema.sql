-- À coller dans l'éditeur SQL de Supabase (Dashboard > SQL Editor > New query)

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000000',
  path text not null unique, -- chemin relatif seulement, ex: "/anime/wandance/"
  -- (pas l'URL complète : le domaine de voiranime change souvent, il est
  -- reconstruit à chaque scraping à partir de la variable d'env BASE_URL)
  title text,
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

-- Index utiles pour les lectures fréquentes du scraper et de l'app web
create index if not exists idx_watchlist_active on watchlist_items(active);
create index if not exists idx_episodes_item on episodes_notified(watchlist_item_id);
create index if not exists idx_episodes_discovered on episodes_notified(discovered_at desc);

-- Note : user_id a une valeur par défaut fixe pour l'instant (pas d'auth).
-- Le jour où tu actives Supabase Auth, tu changeras le default et tu backfilleras
-- les lignes existantes avec ton propre user_id — pas de migration de structure à refaire.
