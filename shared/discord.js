/**
 * Outils Discord partagés entre le scraper (src/) et l'app web (web/).
 * Uniquement du `fetch` natif (Node 18+), pas de dépendance.
 */

export const BRAND_COLOR = 0xe2483a; // vermillon du logo

// Tous les messages s'affichent au nom d'Anime Notifs avec son logo, quel que
// soit le nom ou l'avatar donné au webhook côté Discord.
const SITE_URL = (process.env.SITE_URL || "https://notif-anime.vercel.app").replace(/\/+$/, "");
export const BOT_PROFILE = {
  username: "Anime Notifs",
  avatar_url: `${SITE_URL}/bot-avatar.png`,
};
const FOOTER = { text: "Anime Notifs", icon_url: BOT_PROFILE.avatar_url };

// Seules les vraies URLs de webhook Discord sont acceptées (même règle que la
// contrainte SQL sur notification_channels) : évite qu'on fasse envoyer des
// requêtes vers n'importe quelle adresse.
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const REQUEST_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDiscordWebhookUrl(url) {
  return typeof url === "string" && WEBHOOK_RE.test(url);
}

/** Nettoie une URL collée par l'utilisateur (espaces, slash final, query string). */
export function cleanWebhookUrl(input) {
  return String(input ?? "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** Version affichable d'une URL de webhook : on garde l'id, on masque le token (secret). */
export function maskWebhookUrl(url) {
  const match = /\/api\/webhooks\/(\d+)\//.exec(url || "");
  return match ? `discord.com/api/webhooks/${match[1]}/••••••` : "Webhook Discord";
}

/**
 * Envoie un message sur un webhook. Ne jette jamais d'erreur et ne logue jamais
 * l'URL (elle contient un token secret, et les logs GitHub Actions peuvent être publics).
 * @returns {Promise<"ok" | "gone" | "error">} "gone" = le webhook a été supprimé côté Discord.
 */
export async function postWebhook(url, payload, { retries = 3 } = {}) {
  if (!isDiscordWebhookUrl(url)) return "error";

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      console.error(`❌ Échec de l'envoi Discord: ${err.message}`);
      return "error";
    }

    if (res.ok) return "ok";
    if (res.status === 404 || res.status === 401) return "gone";

    // Limite de débit Discord (~5 messages / 2 s par webhook) : on attend le
    // délai indiqué puis on réessaie.
    if (res.status === 429 && attempt < retries) {
      const body = await res.json().catch(() => ({}));
      const retryAfterSec = Number(body.retry_after ?? res.headers.get("retry-after") ?? 1);
      await sleep(Math.ceil(retryAfterSec * 1000) + 250);
      continue;
    }

    console.error(`❌ Discord a répondu ${res.status} à l'envoi d'un message.`);
    return "error";
  }
}

/**
 * Vérifie qu'un webhook existe et récupère son nom (sans poster de message).
 * @returns {Promise<{ status: "ok" | "gone" | "error", name?: string }>}
 */
export async function getWebhookInfo(url) {
  if (!isDiscordWebhookUrl(url)) return { status: "gone" };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.status === 404 || res.status === 401) return { status: "gone" };
    if (!res.ok) return { status: "error" };
    const info = await res.json();
    return { status: "ok", name: info.name || null };
  } catch {
    return { status: "error" };
  }
}

/** Embed d'un nouvel épisode : titre cliquable, affiche de la série, horodatage. */
export function episodeMessage({ animeTitle, episode, posterUrl }) {
  const embed = {
    title: episode.title,
    url: episode.link || undefined,
    description: `Nouvel épisode de **${animeTitle || "une série suivie"}**`,
    color: BRAND_COLOR,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
  if (posterUrl) embed.thumbnail = { url: posterUrl };
  return { ...BOT_PROFILE, embeds: [embed] };
}

/** Message envoyé quand on branche un salon, ou via le bouton "Tester". */
export function testMessage({ isWelcome = false } = {}) {
  return {
    ...BOT_PROFILE,
    embeds: [
      {
        title: isWelcome ? "✅ Salon connecté à Anime Notifs" : "🔔 Test réussi",
        description: isWelcome
          ? "Les nouveaux épisodes des séries que tu suis seront annoncés ici."
          : "Ce salon reçoit bien les notifications d'Anime Notifs.",
        color: BRAND_COLOR,
        timestamp: new Date().toISOString(),
        footer: FOOTER,
      },
    ],
  };
}
