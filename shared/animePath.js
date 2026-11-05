import { extractPath } from "./extractPath.js";

// Même règle que la contrainte SQL sur animes.path.
const ANIME_PATH_RE = /^\/anime\/[^/]+\/$/;
const MAX_PATH_LENGTH = 200;

/**
 * Transforme ce que l'utilisateur colle en chemin de série voiranime, ou null si
 * ce n'est pas une page de série.
 * - "https://voir-anime.to/anime/wandance/" -> "/anime/wandance/"
 * - un lien d'épisode "…/anime/wandance/wandance-01-vostfr/" -> "/anime/wandance/"
 * - un lien d'un autre site (ex: MyAnimeList) -> null
 */
export function normalizeAnimePath(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  // Lien complet : il doit venir de voiranime, quel que soit son domaine du moment.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      if (!/voir-?anime/i.test(new URL(trimmed).hostname)) return null;
    } catch {
      return null;
    }
  }

  const match = /^\/anime\/([^/]+)\//.exec(extractPath(trimmed));
  if (!match) return null;

  const path = `/anime/${match[1].toLowerCase()}/`;
  return ANIME_PATH_RE.test(path) && path.length <= MAX_PATH_LENGTH ? path : null;
}

/** Titre lisible déduit du chemin, en attendant que le scraper récupère le vrai. */
export function titleFromPath(path) {
  const slug = /^\/anime\/([^/]+)\//.exec(path || "")?.[1];
  if (!slug) return path || "";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // slug mal encodé : on garde tel quel
  }
  return decoded
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
