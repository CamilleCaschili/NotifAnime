# Anime notifs v2

Scraper d'épisodes d'anime (voiranime) qui notifie sur Discord dès qu'un nouvel
épisode sort, avec la watchlist et l'historique stockés dans Supabase.

## Mise en route

### 1. Créer le projet Supabase
- Va sur [supabase.com](https://supabase.com), crée un compte et un nouveau projet (gratuit).
- Dans **Project Settings > API**, récupère :
  - `Project URL` → `SUPABASE_URL`
  - `service_role` key (⚠️ pas `anon`) → `SUPABASE_SERVICE_KEY`

### 2. Créer les tables
- Dans le dashboard Supabase, va dans **SQL Editor > New query**.
- Colle le contenu de `supabase/schema.sql` et exécute.

⚠️ Si tes tables existaient déjà avant, exécute plutôt les migrations manquantes,
dans l'ordre (chacune une seule fois) :
- `supabase/migration_001_url_to_path.sql` — si `watchlist_items` a encore une
  colonne `url` au lieu de `path`.
- `supabase/migration_002_poster_initial_scrape_health.sql` — ajoute les colonnes
  `poster_url` / `initial_scrape_done` et la table `scraper_health` utilisées par
  le scraper.

### 3. Créer un webhook Discord
- Dans Discord, sur le salon où tu veux recevoir les notifs : **Paramètres du salon >
  Intégrations > Webhooks > Nouveau webhook**.
- Copie l'URL du webhook.
- Insère-la dans Supabase, table `notification_channels` :
  ```sql
  insert into notification_channels (type, config)
  values ('discord', '{"webhook_url": "https://discord.com/api/webhooks/..."}');
  ```

### 4. Ajouter tes séries
Via l'app web (voir plus bas) ou la CLI. Tu peux coller l'URL complète, seul le
chemin sera gardé en base (le domaine vient de `BASE_URL`) :
```bash
npm install
npm run add-anime -- https://voir-anime.to/anime/wandance/ "Wandance"
```

### 5. Tester en local
```bash
cp .env.example .env   # puis remplis SUPABASE_URL et SUPABASE_SERVICE_KEY
npm install
npm run test-scrape
```

### 6. Déployer sur GitHub Actions
Dans les **Settings > Secrets and variables > Actions** du repo, ajoute :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `BASE_URL` (ex: `https://voir-anime.to`)

Le workflow `.github/workflows/scrape.yml` tourne ensuite tout seul toutes les 6h,
et peut être déclenché manuellement depuis l'onglet Actions (`workflow_dispatch`).

## Comportement du scraper
- **Ajout d'une série** : au premier scraping, les épisodes déjà sortis sont
  archivés sans notification ; seuls les suivants déclenchent une notif Discord.
- **Affiche** : récupérée automatiquement (`og:image`) et affichée dans l'embed Discord.
- **Alertes** : un message Discord est envoyé si toutes les séries échouent
  2 runs d'affilée (max une fois par 24h), ou si voiranime redirige vers un
  nouveau domaine — pense alors à mettre à jour `BASE_URL`.

## App web
Dossier `web/` (Next.js) : ajout / pause / suppression de séries et liste des
derniers épisodes détectés, protégée par une authentification HTTP Basic.

En local :
```bash
cd web
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_KEY, APP_USERNAME, APP_PASSWORD
npm install
npm run dev            # http://localhost:3000
```

Sur Vercel : importer le repo avec **Root Directory = `web`** et définir les
mêmes quatre variables d'environnement.
