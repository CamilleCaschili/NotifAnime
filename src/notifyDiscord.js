import axios from "axios";

const EMBED_COLOR = 0x7c9aff; // même bleu que l'app web

/**
 * Envoie un message brut sur un webhook Discord (utilisé pour les alertes système).
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
 * Envoie une notification Discord "riche" (embed) pour un épisode détecté :
 * titre cliquable, couleur, affiche de la série si disponible, horodatage.
 */
export async function sendDiscordNotification(webhookUrl, { animeTitle, episode, posterUrl }) {
  if (!webhookUrl) return;

  const embed = {
    title: episode.title,
    url: episode.link || undefined,
    description: `Nouvel épisode de **${animeTitle || "une série suivie"}**`,
    color: EMBED_COLOR,
    timestamp: new Date().toISOString(),
    footer: { text: "Anime Notifs" },
  };

  if (posterUrl) {
    embed.thumbnail = { url: posterUrl };
  }

  try {
    await axios.post(webhookUrl, { embeds: [embed] }, { timeout: 10000 });
  } catch (err) {
    console.error(`❌ Échec de la notification Discord: ${err.message}`);
  }
}