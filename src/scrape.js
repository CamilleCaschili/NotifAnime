import axios from "axios";
import { load } from "cheerio";
import { supabase } from "./supabaseClient.js";
import { extractPath } from "../shared/extractPath.js";
import { BOT_PROFILE, isDiscordWebhookUrl, postWebhook, episodeMessage } from "../shared/discord.js";

const BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
// Alertes techniques (domaine qui change, scraping cassé) : uniquement pour
// l'admin, jamais dans les salons des utilisateurs.
const ADMIN_WEBHOOK_URL = process.env.ADMIN_WEBHOOK_URL || null;
const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_REQUESTS_MS = 2000;
const PAGE_SIZE = 1000; // Supabase renvoie au maximum 1000 lignes par requête
const INSERT_CHUNK_SIZE = 500;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reconstruit une URL absolue à partir du domaine courant (BASE_URL) + un chemin relatif.
// Le domaine de voiranime change régulièrement (blocages FAI) : ne jamais stocker
// d'URL complète en base, uniquement le chemin, pour n'avoir qu'une seule variable
// à mettre à jour le jour où le domaine change.
function buildUrl(path) {
  if (!path) return BASE;
  if (path.startsWith("http")) return path; // déjà une URL absolue (par sécurité)
  return BASE + (path.startsWith("/") ? path : `/${path}`);
}

// Récupère l'affiche de la série (og:image en priorité, robuste sur la plupart
// des sites, puis quelques sélecteurs courants des thèmes WordPress manga).
function extractPoster($) {
  const og = $('meta[property="og:image"]').attr("content");
  if (og) return og;

  const img = $(".summary_image img, .thumb img, .anime-thumb img").first();
  return img.attr("src") || img.attr("data-src") || null;
}

// Titre de la série : le titre de la fiche (thème Madara), sinon og:title /
// <title> sans le suffixe " - Nom du site".
function extractTitle($) {
  const heading = $(".post-title h1, .post-title h3").first().clone();
  heading.find("span").remove(); // badges type "HOT", "NEW"
  const fromHeading = heading.text().replace(/\s+/g, " ").trim();
  if (fromHeading) return fromHeading.slice(0, 200);

  const raw = $('meta[property="og:title"]').attr("content") || $("title").first().text() || "";
  const cleaned = raw.replace(/\s+[-–|]\s+[^-–|]*$/, "").trim();
  return cleaned ? cleaned.slice(0, 200) : null;
}

function absoluteLink(href) {
  if (!href) return "";
  return href.startsWith("http") ? href : BASE + (href.startsWith("/") ? href : `/${href}`);
}

function extractEpisodes($, pageUrl) {
  const episodes = [];

  // L'identifiant d'un épisode est son chemin, sans le domaine : si voiranime
  // change de domaine, les épisodes déjà connus restent reconnus.
  $(".wp-manga-chapter").each((i, el) => {
    const $el = $(el);
    let title = $el.find(".episode-title, .title, h3").first().text().trim();
    if (!title) title = $el.find("a").first().text().trim();

    const link = absoluteLink($el.find("a").first().attr("href"));
    const id = link ? extractPath(link) : `${title}-${i}`;
    const description = $el.find(".description, .excerpt").text().trim() || "";

    if (title && id) {
      episodes.push({ id, title, link, description });
    }
  });

  if (episodes.length === 0) {
    $("a").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (/episode/i.test(href)) {
        const title = $(el).text().trim() || "Episode";
        const link = absoluteLink(href);
        episodes.push({ id: extractPath(link), title, link, description: "" });
      }
    });
  }

  if (episodes.length === 0) {
    console.warn(`⚠️  Aucun épisode trouvé sur ${pageUrl} — la page a peut-être changé de structure.`);
  }

  // Une même page peut lister deux fois le même épisode.
  const seen = new Set();
  return episodes.filter((ep) => (seen.has(ep.id) ? false : seen.add(ep.id)));
}

// Lit toutes les lignes d'une requête, page par page (sinon Supabase tronque à 1000).
async function fetchAll(buildQuery, label) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Lecture ${label}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Séries suivies par au moins un utilisateur actif, avec la liste de ces utilisateurs.
async function getAnimesToScrape() {
  return fetchAll(
    () =>
      supabase
        .from("animes")
        .select("id, path, title, poster_url, initial_scrape_done, subscriptions!inner(user_id)")
        .eq("subscriptions.active", true)
        .order("id"),
    "animes"
  );
}

// user_id -> liste des URLs de webhook actives de cet utilisateur.
async function getWebhooksByUser() {
  const rows = await fetchAll(
    () =>
      supabase
        .from("notification_channels")
        .select("user_id, config")
        .eq("type", "discord")
        .eq("active", true)
        .order("id"),
    "notification_channels"
  );

  const byUser = new Map();
  for (const row of rows) {
    const url = row.config?.webhook_url;
    if (!isDiscordWebhookUrl(url)) continue;
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(url);
  }
  return byUser;
}

// Insère les épisodes et renvoie les identifiants de ceux qui étaient vraiment
// nouveaux (les doublons sont ignorés par la base, pas besoin de charger
// l'historique complet des épisodes en mémoire).
async function insertNewEpisodes(animeId, episodes, isBacklog) {
  const insertedIds = new Set();
  for (let i = 0; i < episodes.length; i += INSERT_CHUNK_SIZE) {
    const rows = episodes.slice(i, i + INSERT_CHUNK_SIZE).map((ep) => ({
      anime_id: animeId,
      episode_id: ep.id,
      title: ep.title,
      link: ep.link,
      description: ep.description,
      is_backlog: isBacklog,
    }));
    const { data, error } = await supabase
      .from("episodes_notified")
      .upsert(rows, { onConflict: "episode_id", ignoreDuplicates: true })
      .select("episode_id");
    if (error) throw new Error(`Insertion des épisodes: ${error.message}`);
    for (const row of data) insertedIds.add(row.episode_id);
  }
  return insertedIds;
}

async function updateAnime(id, patch) {
  const { error } = await supabase.from("animes").update(patch).eq("id", id);
  if (error) console.error(`❌ Mise à jour de la série ${id}: ${error.message}`);
}

async function deactivateWebhooks(urls) {
  for (const url of urls) {
    const { error } = await supabase
      .from("notification_channels")
      .update({ active: false })
      .eq("config->>webhook_url", url);
    if (error) console.error(`❌ Désactivation d'un webhook: ${error.message}`);
  }
}

async function getHealth() {
  const { data, error } = await supabase.from("scraper_health").select("*").eq("id", 1).single();
  if (error) throw new Error(`Lecture scraper_health: ${error.message}`);
  return data;
}

async function updateHealth(patch) {
  const { error } = await supabase.from("scraper_health").update(patch).eq("id", 1);
  if (error) console.error(`❌ Mise à jour scraper_health: ${error.message}`);
}

async function alertAdmin(content) {
  console.warn(`📣 Alerte admin: ${content}`);
  if (ADMIN_WEBHOOK_URL) await postWebhook(ADMIN_WEBHOOK_URL, { ...BOT_PROFILE, content });
}

export default async function scrapeEpisodes() {
  const animes = await getAnimesToScrape();

  if (animes.length === 0) {
    console.warn("⚠️  Aucune série suivie, rien à scraper.");
    return [];
  }

  const webhooksByUser = await getWebhooksByUser();
  const goneWebhooks = new Set();

  const newEpisodesTotal = [];
  const errors = [];
  let notificationsSent = 0;
  let redirectedHost = null;

  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i];
    const pageUrl = buildUrl(anime.path);
    console.log(`[${i + 1}/${animes.length}] Scraping: ${pageUrl}`);

    try {
      let response;
      try {
        response = await axios.get(pageUrl, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { "User-Agent": USER_AGENT },
        });
      } catch (err) {
        const status = err.response?.status;
        await updateAnime(anime.id, {
          last_scraped_at: new Date().toISOString(),
          last_error: status === 404 ? "Page introuvable sur voiranime" : status ? `Erreur HTTP ${status}` : "Site injoignable",
        });
        throw err;
      }

      // Si voiranime redirige vers un autre domaine, on le détecte pour alerter
      // avant que ça casse complètement (le domaine change régulièrement).
      const finalUrl = response.request?.res?.responseUrl;
      if (finalUrl && !redirectedHost) {
        try {
          const finalHost = new URL(finalUrl).host;
          const baseHost = new URL(BASE).host;
          if (finalHost !== baseHost) redirectedHost = finalHost;
        } catch {
          // URL invalide, on ignore silencieusement
        }
      }

      const $ = load(response.data);
      const patch = { last_scraped_at: new Date().toISOString(), last_error: null };

      if (!anime.poster_url) {
        const poster = extractPoster($);
        if (poster) patch.poster_url = anime.poster_url = poster;
      }
      if (!anime.title) {
        const title = extractTitle($);
        if (title) patch.title = anime.title = title;
      }

      const episodes = extractEpisodes($, pageUrl);
      const isFirstScrape = !anime.initial_scrape_done;
      const insertedIds = await insertNewEpisodes(anime.id, episodes, isFirstScrape);
      // La page liste les épisodes du plus récent au plus ancien : on notifie
      // dans l'ordre de sortie.
      const newEpisodes = episodes.filter((ep) => insertedIds.has(ep.id)).reverse();
      newEpisodesTotal.push(...newEpisodes);

      if (isFirstScrape) {
        // Premier passage sur une série : on archive le backlog existant sans
        // notifier, sinon ajouter une série avec 1000+ épisodes déjà sortis
        // enverrait autant de notifications Discord d'un coup.
        // Si la page ne ressemble pas à une fiche d'anime (aucun épisode ni
        // titre de fiche), on ne valide pas l'analyse : sinon, le jour où la
        // page s'affiche correctement, tout le backlog serait notifié.
        if (episodes.length > 0 || $(".post-title").length > 0) {
          patch.initial_scrape_done = true;
        }
        if (newEpisodes.length > 0) {
          console.log(
            `🔕 Première analyse de "${anime.title || anime.path}" : ${newEpisodes.length} épisode(s) archivé(s) sans notification.`
          );
        }
      } else if (newEpisodes.length > 0) {
        // Plusieurs abonnés peuvent partager le même salon : un seul message par salon.
        const webhooks = [
          ...new Set(anime.subscriptions.flatMap((s) => webhooksByUser.get(s.user_id) ?? [])),
        ].filter((url) => !goneWebhooks.has(url));

        for (const ep of newEpisodes) {
          for (const url of webhooks) {
            if (goneWebhooks.has(url)) continue;
            const result = await postWebhook(
              url,
              episodeMessage({ animeTitle: anime.title || pageUrl, episode: ep, posterUrl: anime.poster_url })
            );
            if (result === "ok") notificationsSent++;
            if (result === "gone") goneWebhooks.add(url);
          }
        }
      }

      await updateAnime(anime.id, patch);
    } catch (err) {
      console.error(`❌ Échec du scraping de ${pageUrl}: ${err.message}`);
      errors.push({ url: pageUrl, message: err.message });
    }

    if (i < animes.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  if (goneWebhooks.size > 0) {
    console.log(`🧹 ${goneWebhooks.size} webhook(s) supprimé(s) côté Discord, désactivé(s).`);
    await deactivateWebhooks(goneWebhooks);
  }

  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length}/${animes.length} série(s) en échec ce run.`);
  }
  console.log(`📨 ${notificationsSent} notification(s) Discord envoyée(s).`);

  await checkScraperHealth({ allFailed: errors.length === animes.length, redirectedHost });

  return newEpisodesTotal;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function checkScraperHealth({ allFailed, redirectedHost }) {
  const health = await getHealth();

  if (allFailed) {
    const newCount = health.consecutive_full_failures + 1;
    const alertedRecently =
      health.last_failure_alert_at &&
      Date.now() - new Date(health.last_failure_alert_at).getTime() < ONE_DAY_MS;
    const shouldAlert = newCount >= 2 && !alertedRecently;

    await updateHealth({
      consecutive_full_failures: newCount,
      ...(shouldAlert ? { last_failure_alert_at: new Date().toISOString() } : {}),
    });

    if (shouldAlert) {
      await alertAdmin(
        `⚠️ **Le scraping échoue sur toutes les séries** depuis ${newCount} run(s) d'affilée.\nLe domaine \`${BASE}\` a peut-être changé ou est bloqué. Vérifie voiranime et mets à jour \`BASE_URL\` si besoin.`
      );
    }
  } else if (health.consecutive_full_failures > 0) {
    await updateHealth({ consecutive_full_failures: 0 });
  }

  if (redirectedHost && redirectedHost !== health.last_redirect_alert_host) {
    await updateHealth({
      last_redirect_alert_host: redirectedHost,
      last_redirect_alert_at: new Date().toISOString(),
    });
    await alertAdmin(
      `🔀 **voiranime semble avoir redirigé vers un nouveau domaine** : \`${redirectedHost}\`.\nPense à mettre à jour \`BASE_URL\` (actuellement \`${BASE}\`) si ça se confirme.`
    );
  }
}

// Permet de lancer `node src/scrape.js` directement (npm run test-scrape)
// sans dupliquer la logique de index.js.
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeEpisodes()
    .then((newEpisodes) => {
      console.log(`✅ ${newEpisodes.length} nouvel(le/aux) épisode(s) détecté(s).`);
    })
    .catch((err) => {
      console.error("❌ Erreur fatale:", err);
      process.exit(1);
    });
}

// Exportés pour les tests
export { extractEpisodes, extractTitle, extractPoster };
