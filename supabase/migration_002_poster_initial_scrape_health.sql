-- À exécuter UNE SEULE FOIS si tes tables ont été créées avant l'ajout des
-- affiches, de l'archivage silencieux du premier scraping et du suivi de santé
-- du scraper. Sans risque à relancer (tout est en "if not exists").
-- Colle ça dans SQL Editor > New query > Run.

-- 1. Nouvelles colonnes de watchlist_items
alter table watchlist_items add column if not exists poster_url text;
alter table watchlist_items add column if not exists initial_scrape_done boolean not null default false;

-- 2. Les séries qui ont déjà des épisodes en base ont forcément déjà été
--    scrapées : on les marque comme analysées, sinon leurs prochains épisodes
--    seraient archivés sans notification au prochain run.
update watchlist_items w
set initial_scrape_done = true
where exists (select 1 from episodes_notified e where e.watchlist_item_id = w.id);

-- 3. Table de santé du scraper (une seule ligne, id = 1)
create table if not exists scraper_health (
  id int primary key default 1 check (id = 1),
  consecutive_full_failures int not null default 0,
  last_failure_alert_at timestamptz,
  last_redirect_alert_host text,
  last_redirect_alert_at timestamptz
);

insert into scraper_health (id) values (1) on conflict (id) do nothing;
