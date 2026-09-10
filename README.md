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
En attendant l'app web, utilise la CLI. Tu peux coller l'URL complète, seul le
chemin sera gardé en base (le domaine vient de `BASE_URL`) :
```bash
npm install
npm run add-anime -- https://voir-anime.to/anime/wandance/ "Wandance"
```

⚠️ Si tu avais déjà créé les tables **avant** cette version, exécute d'abord
`supabase/migration_001_url_to_path.sql` dans le SQL Editor de Supabase — sinon
`watchlist_items` a encore l'ancienne colonne `url` au lieu de `path`.

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
- `BASE_URL` (ex: `https://v6.voiranime.com`)

Le workflow `.github/workflows/scrape.yml` tourne ensuite tout seul toutes les 6h,
et peut être déclenché manuellement depuis l'onglet Actions (`workflow_dispatch`).

## À venir
Une app web (Next.js + Vercel) pour gérer la watchlist sans passer par la CLI.
