import axios from "axios";

/**
 * Envoie un message brut sur un webhook Discord (utilisé aussi pour les alertes).
 */
export async function sendDiscordMessage(webhookUrl, content) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, { content }, { timeout: 10000 });
  } catch (err) {
    console.error(`❌ Échec de l'envoi Discord: ${err.message}`);
  }
}

/**
 * Envoie une notification Discord pour un épisode nouvellement détecté.
 */
export async function sendDiscordNotification(webhookUrl, { animeTitle, episode }) {
  const content = `📺 **${animeTitle || "Nouvel épisode"}**\n${episode.title}\n${episode.link}`;
  await sendDiscordMessage(webhookUrl, content);
}