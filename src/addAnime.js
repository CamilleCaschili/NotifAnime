import { supabase } from "./supabaseClient.js";

/**
 * Extrait le chemin (path) d'une URL, quel que soit le domaine collé.
 * Ex: "https://voir-anime.to/anime/wandance/" -> "/anime/wandance/"
 * Ex: "/anime/wandance/" (déjà un chemin) -> "/anime/wandance/"
 */
function extractPath(input) {
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

async function main() {
  const input = process.argv[2];
  const title = process.argv[3]; // optionnel

  if (!input) {
    console.error(
      'Usage: npm run add-anime -- https://voir-anime.to/anime/nom/ "Titre (optionnel)"'
    );
    process.exit(1);
  }

  const path = extractPath(input);

  const { error } = await supabase.from("watchlist_items").insert({ path, title: title || null });

  if (error) {
    if (error.code === "23505") {
      console.log("ℹ️  Cette série est déjà dans la watchlist.");
      return;
    }
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }

  console.log(`✅ Ajoutée : ${path} (le domaine BASE_URL sera préfixé automatiquement au scraping)`);
}

main();
