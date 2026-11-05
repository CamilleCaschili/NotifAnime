# Anime Notifs

Site public : chacun se connecte avec son compte Discord, suit ses séries
voiranime et reçoit un message dans **son** serveur Discord (via un webhook)
dès qu'un nouvel épisode sort.

```
GitHub Actions (cron 6h) ──► Supabase (Postgres + Auth) ◄── Site web (Next.js, Vercel)
        │                                                     connexion Discord
        ▼
 webhooks Discord de chaque utilisateur
```

- **Site (`web/`)** : accueil, guide pour créer un webhook Discord (`/guide`),
  tableau de bord (`/dashboard`) pour connecter ses salons et gérer ses séries.
  Il utilise la clé `anon` + la session de l'utilisateur : la Row Level Security
  de Supabase garantit que chacun ne voit et ne modifie que ses propres données.
- **Scraper (`src/`)** : chaque série suivie n'est scrapée qu'une fois par run,
  puis les nouveaux épisodes sont postés dans les salons de tous ses abonnés
  (un seul message par salon). Il utilise la clé `service_role`.
- **Base (`supabase/`)** : `animes` (catalogue partagé), `subscriptions` (qui
  suit quoi), `episodes_notified`, `notification_channels` (webhooks par
  utilisateur), `scraper_health`.

Les nouveaux utilisateurs n'ont rien à faire de spécial : leur compte est créé
automatiquement à leur première connexion avec Discord, puis ils branchent leur
salon et ajoutent leurs séries depuis le tableau de bord.

## Passer de la version perso à la version publique (une seule fois)

Fais les étapes **dans l'ordre** : la migration SQL a besoin que ton compte
existe, donc qu'on puisse déjà se connecter au site.

### 1. Créer l'application Discord (pour « Se connecter avec Discord »)
1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
   > **New Application**, nomme-la « Anime Notifs ».
2. Onglet **OAuth2** : note le **Client ID**, puis **Reset Secret** pour obtenir
   le **Client Secret**.
3. Toujours dans **OAuth2 > Redirects**, ajoute l'URL de callback donnée par
   Supabase à l'étape suivante (`https://<ton-projet>.supabase.co/auth/v1/callback`).

### 2. Configurer Supabase Auth
1. **Authentication > Sign In / Providers > Discord** : active-le, colle le
   Client ID et le Client Secret, enregistre. (L'URL de callback à mettre dans
   Discord est affichée ici.)
2. **Authentication > URL Configuration** :
   - Site URL : `https://notif-anime.vercel.app`
   - Redirect URLs : `https://notif-anime.vercel.app/**` et `http://localhost:3000/**`

### 3. Variables d'environnement
- **Vercel** (Settings > Environment Variables) :
  - ajoute `SUPABASE_ANON_KEY` = la clé `anon` / `publishable` (Supabase >
    Project Settings > API Keys) ;
  - garde `SUPABASE_URL` ;
  - supprime `SUPABASE_SERVICE_KEY`, `APP_USERNAME` et `APP_PASSWORD` : le site
    ne s'en sert plus.
- **GitHub** (Settings > Secrets and variables > Actions) : ajoute
  `ADMIN_WEBHOOK_URL` = ton webhook Discord actuel. Les alertes techniques
  (domaine qui change, scraping cassé) n'iront que là, jamais chez les
  utilisateurs. Optionnel, mais sans lui ces alertes ne sont que dans les logs.
- **En local** : `web/.env` doit contenir `SUPABASE_URL` et `SUPABASE_ANON_KEY`
  (voir `web/.env.example`).

### 4. Déployer
Pousse sur `master` : Vercel déploie le site. Jusqu'à l'étape 6, le tableau de
bord et le scraper renvoient une erreur, c'est normal (la base n'est pas encore
migrée).

### 5. Créer ton compte
Ouvre https://notif-anime.vercel.app et clique sur **Se connecter avec Discord**.

### 6. Migrer la base
Dans **SQL Editor > New query**, colle `supabase/migration_003_public_multi_user.sql`,
remplace l'email de la ligne marquée ⬅️ par celui de ton compte (visible dans
**Authentication > Users**), puis **Run**. Tes séries et ton webhook actuels
sont rattachés à ton compte. En cas d'erreur, rien n'est modifié.

### 7. Vérifier
Recharge le tableau de bord : tes séries et ton salon doivent y être. Clique
sur **Tester** à côté du salon, puis lance le workflow à la main (onglet
**Actions > Scraping anime > Run workflow**).

## Installation neuve (nouveau projet Supabase)

1. Crée un projet sur [supabase.com](https://supabase.com), puis exécute
   `supabase/schema.sql` dans **SQL Editor**.
2. Configure la connexion Discord (étapes 1 et 2 ci-dessus).
3. **GitHub Actions** : secrets `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (clé
   `service_role`, ⚠️ pas `anon`), `BASE_URL` (ex: `https://voir-anime.to`) et,
   en option, `ADMIN_WEBHOOK_URL`. Le workflow `.github/workflows/scrape.yml`
   tourne toutes les 6 h et peut être lancé à la main (`workflow_dispatch`).
4. **Vercel** : importe le repo avec **Root Directory = `web`**, variables
   `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

## En local

```bash
# Scraper
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_KEY, BASE_URL
npm install
npm run test-scrape

# Site
cd web
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:3000
```

## Comportement
- **Ajout d'une série** : au premier scraping, les épisodes déjà sortis sont
  archivés sans notification ; seuls les suivants déclenchent une notif. Même
  chose quand quelqu'un se remet à suivre une série que plus personne ne suivait.
- **Titre et affiche** : récupérés automatiquement sur la page de la série.
- **Lien cassé** : l'erreur (ex: page introuvable) s'affiche sur la série dans
  le tableau de bord.
- **Webhook supprimé côté Discord** : le salon est désactivé automatiquement ;
  le bouton « Tester » le réactive s'il refonctionne.
- **Changement de domaine voiranime** : les épisodes sont identifiés par leur
  chemin (sans domaine), donc rien n'est renvoyé. Mets à jour le secret
  `BASE_URL` ; une alerte part sur `ADMIN_WEBHOOK_URL` si voiranime redirige
  ailleurs ou si toutes les séries échouent 2 runs d'affilée.
- **Limites par compte** : 100 séries et 5 salons (définies dans
  `supabase/schema.sql` et `web/lib/notices.js`).
- **Suppression de compte** : depuis le tableau de bord ; abonnements et salons
  partent avec.

## Dépannage
- **« La connexion avec Discord n'a pas abouti »** : le détail est dans Vercel >
  Logs (chercher « Connexion Discord »).
  - `Database error saving new user` : un trigger sur `auth.users` plante à la
    création du compte. Liste-les avec
    `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;`.
    Le site n'en a besoin d'aucun.
  - `Unable to exchange external code` : Client Secret Discord incorrect dans Supabase.
- **Page « Oups, cette page n'a pas pu s'afficher »** : le code d'erreur affiché
  permet de retrouver l'erreur exacte dans Vercel > Logs.
