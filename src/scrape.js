import axios from "axios";
import { load } from "cheerio";
import { supabase } from "./supabaseClient.js";
import { sendDiscordNotification, sendDiscordMessage } from "./notifyDiscord.js";
 
const BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_REQUESTS_MS = 2000;
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
 
function extractEpisodes($, pageUrl) {
  const episodes = [];
 
  $(".wp-manga-chapter").each((i, el) => {
    const $el = $(el);
    let title = $el.find(".episode-title, .title, h3").first().text().trim();
    if (!title) title = $el.find("a").first().text().trim();
 
    let href = $el.find("a").first().attr("href") || "";
    if (href && !href.startsWith("http")) href = BASE + href;
 
    const id = href || title + "-" + i;
    const description = $el.find(".description, .excerpt").text().trim() || "";
 
    if (title && id) {
      episodes.push({ id, title, link: href, description });
    }
  });
 
  if (episodes.length === 0) {
    $("a").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (/episode/i.test(href)) {
        const title = $(el).text().trim() || "Episode";
        const full = href.startsWith("http") ? href : BASE + href;
        episodes.push({ id: full, title, link: full, description: "" });
      }
    });
  }
 
  if (episodes.length === 0) {
    console.warn(`⚠️  Aucun épisode trouvé sur ${pageUrl} — la page a peut-être changé de structure.`);
  }
 
  return episodes;
}
 
async function getActiveWatchlist() {
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("id, path, title, initial_scrape_done, poster_url")
    .eq("active", true);
 
  if (error) throw new Error(`Lecture watchlist_items: ${error.message}`);
  return data || [];
}
 
async function getKnownEpisodeIds() {
  const { data, error } = await supabase.from("episodes_notified").select("episode_id");
  if (error) throw new Error(`Lecture episodes_notified: ${error.message}`);
  return new Set((data || []).map((row) => row.episode_id));
}
 
async function getActiveDiscordWebhooks() {
  const { data, error } = await supabase
    .from("notification_channels")
    .select("config")
    .eq("type", "discord")
    .eq("active", true);
 
  if (error) throw new Error(`Lecture notification_channels: ${error.message}`);
  return (data || []).map((row) => row.config?.webhook_url).filter(Boolean);
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
 
export default async function scrapeEpisodes() {
  const watchlist = await getActiveWatchlist();
 
  if (watchlist.length === 0) {
    console.warn("⚠️  Aucune série active dans watchlist_items, rien à scraper.");
    return [];
  }
 
  const seenIds = await getKnownEpisodeIds();
  const webhooks = await getActiveDiscordWebhooks();
 
  const newEpisodesTotal = [];
  const errors = [];
  let redirectedHost = null;
 
  for (let i = 0; i < watchlist.length; i++) {
    const item = watchlist[i];
    const pageUrl = buildUrl(item.path);
    console.log(`[${i + 1}/${watchlist.length}] Scraping: ${pageUrl}`);
 
    try {
      const response = await axios.get(pageUrl, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": USER_AGENT },
      });
      const { data } = response;
 
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
 
      const $ = load(data);
 
      if (!item.poster_url) {
        const poster = extractPoster($);
        if (poster) {
          item.poster_url = poster;
          const { error: posterError } = await supabase
            .from("watchlist_items")
            .update({ poster_url: poster })
            .eq("id", item.id);
          if (posterError) {
            console.error(`❌ Impossible d'enregistrer le poster de "${item.path}": ${posterError.message}`);
          }
        }
      }
 
      const episodes = extractEpisodes($, pageUrl);
      const newEpisodes = episodes.filter((e) => e.id && !seenIds.has(e.id));
      const isFirstScrape = !item.initial_scrape_done;
 
      if (isFirstScrape && newEpisodes.length > 0) {
        console.log(
          `🔕 Première analyse de "${item.title || item.path}" : ${newEpisodes.length} épisode(s) archivé(s) sans notification.`
        );
      }
 
      for (const ep of newEpisodes) {
        seenIds.add(ep.id); // évite les doublons si deux pages référencent le même id dans ce run
 
        const { error: insertError } = await supabase.from("episodes_notified").insert({
          watchlist_item_id: item.id,
          episode_id: ep.id,
          title: ep.title,
          link: ep.link,
          description: ep.description,
        });
 
        if (insertError) {
          console.error(`❌ Insertion échouée pour ${ep.id}: ${insertError.message}`);
          continue;
        }
 
        newEpisodesTotal.push(ep);
 
        // Lors du tout premier passage sur une série, on archive le backlog
        // existant sans notifier — sinon ajouter une série avec 1000+ épisodes
        // déjà sortis enverrait autant de notifications Discord d'un coup.
        if (!isFirstScrape) {
          for (const webhookUrl of webhooks) {
            await sendDiscordNotification(webhookUrl, {
              animeTitle: item.title || pageUrl,
              episode: ep,
              posterUrl: item.poster_url,
            });
          }
        }
      }
 
      if (isFirstScrape) {
        const { error: flagError } = await supabase
          .from("watchlist_items")
          .update({ initial_scrape_done: true })
          .eq("id", item.id);
        if (flagError) {
          console.error(`❌ Impossible de marquer "${item.path}" comme analysée: ${flagError.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ Échec du scraping de ${pageUrl}: ${err.message}`);
      errors.push({ url: pageUrl, message: err.message });
    }
 
    if (i < watchlist.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }
 
  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length}/${watchlist.length} série(s) en échec ce run.`);
  }
 
  await checkScraperHealth({ allFailed: errors.length === watchlist.length, redirectedHost, webhooks });
 
  return newEpisodesTotal;
}
 
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
 
async function checkScraperHealth({ allFailed, redirectedHost, webhooks }) {
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
      const msg = `⚠️ **Le scraping échoue sur toutes les séries** depuis ${newCount} run(s) d'affilée.\nLe domaine \`${BASE}\` a peut-être changé ou est bloqué. Vérifie voiranime et mets à jour \`BASE_URL\` si besoin.`;
      for (const webhookUrl of webhooks) await sendDiscordMessage(webhookUrl, msg);
    }
  } else if (health.consecutive_full_failures > 0) {
    await updateHealth({ consecutive_full_failures: 0 });
  }
 
  if (redirectedHost && redirectedHost !== health.last_redirect_alert_host) {
    await updateHealth({
      last_redirect_alert_host: redirectedHost,
      last_redirect_alert_at: new Date().toISOString(),
    });
    const msg = `🔀 **voiranime semble avoir redirigé vers un nouveau domaine** : \`${redirectedHost}\`.\nPense à mettre à jour \`BASE_URL\` (actuellement \`${BASE}\`) si ça se confirme.`;
    for (const webhookUrl of webhooks) await sendDiscordMessage(webhookUrl, msg);
  }
}
 
// Permet de lancer `node src/scrape.js` directement (npm run test-scrape)
// sans dupliquer la logique de index.js.
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeEpisodes()
    .then((newEpisodes) => {
      console.log(`✅ ${newEpisodes.length} nouvel(le/aux) épisode(s) détecté(s) et notifié(s).`);
    })
    .catch((err) => {
      console.error("❌ Erreur fatale:", err);
      process.exit(1);
    });
}
