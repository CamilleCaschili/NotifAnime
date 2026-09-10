-- À exécuter UNE SEULE FOIS si ta table watchlist_items a déjà été créée
-- avec l'ancien schéma (colonne "url" au lieu de "path").
-- Colle ça dans SQL Editor > New query > Run.

-- 1. Renomme la colonne (garde les données existantes et la contrainte unique)
alter table watchlist_items rename column url to path;

-- 2. Nettoie les valeurs existantes : ne garde que le chemin, retire le domaine
update watchlist_items
set path = regexp_replace(path, '^https?://[^/]+', '')
where path ~ '^https?://';

-- Vérifie le résultat :
-- select path, title from watchlist_items;
