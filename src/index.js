import scrapeEpisodes from "./scrape.js";

async function main() {
  const newEpisodes = await scrapeEpisodes();
  console.log(`✅ ${newEpisodes.length} nouvel(le/aux) épisode(s) détecté(s) et notifié(s).`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});
