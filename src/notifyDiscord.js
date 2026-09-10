import axios from "axios";

/**
 * Envoie une notification Discord pour un épisode nouvellement détecté.
 * Utilise l'API "webhook" de Discord, aucune lib externe nécessaire.
 */
export async function sendDiscordNotification(webhookUrl, { animeTitle, episode }) {
  if (!webhookUrl) return;

  const content = `📺 **${animeTitle || "Nouvel épisode"}**\n${episode.title}\n${episode.link}`;

  try {
    await axios.post(webhookUrl, { content }, { timeout: 10000 });
  } catch (err) {
    // On ne fait pas planter tout le run pour une notif ratée : on log et on continue.
    console.error(`❌ Échec de la notification Discord: ${err.message}`);
  }
}
