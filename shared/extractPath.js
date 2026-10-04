/**
 * Extrait le chemin (path) d'une URL, quel que soit le domaine collé.
 * Partagé entre la CLI (src/addAnime.js) et l'app web (web/app/actions.js).
 * Ex: "https://voir-anime.to/anime/wandance/" -> "/anime/wandance/"
 * Ex: "/anime/wandance/" (déjà un chemin) -> "/anime/wandance/"
 */
export function extractPath(input) {
  const trimmed = input.trim();
  try {
    const parsed = new URL(trimmed); // lève une erreur si ce n'est pas une URL absolue
    return parsed.pathname.replace(/\/?$/, "/");
  } catch {
    // Pas une URL absolue : on suppose que c'est déjà un chemin relatif
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.replace(/\/?$/, "/");
  }
}
