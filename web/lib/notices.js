import { VOIRANIME_URL } from "./voiranime.js";

// Limites appliquées par la base (voir supabase/schema.sql) — à garder synchronisées.
export const MAX_SUBSCRIPTIONS = 100;
export const MAX_CHANNELS = 5;

// Les Server Actions redirigent avec ?notice=<code> ; on n'affiche que des
// messages connus (jamais de texte venant de l'URL).
const NOTICES = {
  // Connexion / compte
  login_required: ["info", "Connecte-toi pour accéder à ton tableau de bord."],
  login_failed: ["error", "La connexion avec Discord n'a pas abouti. Réessaie."],
  login_cancelled: ["info", "Connexion annulée sur Discord."],
  login_email_required: ["error", "Discord n'a pas transmis d'adresse email : vérifie l'email de ton compte Discord (Paramètres > Mon compte), puis réessaie."],
  account_deleted: ["success", "Ton compte et toutes tes données ont été supprimés."],
  confirm_required: ["error", "Coche la case de confirmation pour supprimer ton compte."],

  // Séries
  anime_added: ["success", "Série ajoutée ! Ses épisodes déjà sortis seront archivés sans notif à la prochaine analyse : seuls les suivants te seront annoncés."],
  already_following: ["info", "Tu suis déjà cette série."],
  invalid_anime_url: ["error", `Ce lien n'est pas une page de série voiranime. Exemple attendu : ${VOIRANIME_URL}/anime/wandance/`],
  subscription_limit: ["error", `Tu as atteint la limite de ${MAX_SUBSCRIPTIONS} séries. Retire-en une pour en ajouter une autre.`],
  subscription_paused: ["success", "Série mise en pause : plus de notifs pour elle jusqu'à ce que tu la reprennes."],
  subscription_resumed: ["success", "Série reprise : tu seras notifié des prochains épisodes."],
  anime_removed: ["success", "Série retirée de ta liste."],

  // Salons Discord
  channel_added: ["success", "Salon connecté ! Un message de confirmation vient d'y être posté."],
  invalid_webhook_url: ["error", "Ce n'est pas une URL de webhook Discord. Elle doit ressembler à https://discord.com/api/webhooks/123…/abc…"],
  webhook_not_found: ["error", "Discord ne reconnaît pas ce webhook : il a peut-être été supprimé. Crée-en un nouveau (voir le guide)."],
  webhook_already_added: ["info", "Ce salon est déjà connecté."],
  channel_limit: ["error", `Tu peux connecter au maximum ${MAX_CHANNELS} salons.`],
  discord_unreachable: ["error", "Discord ne répond pas pour le moment. Réessaie dans quelques minutes."],
  test_sent: ["success", "Message de test envoyé : va voir ton salon Discord."],
  channel_deleted: ["success", "Salon déconnecté. Pense aussi à supprimer le webhook dans Discord si tu ne t'en sers plus."],

  error: ["error", "Une erreur inattendue est survenue. Réessaie."],
};

export function getNotice(code) {
  const notice = NOTICES[code];
  return notice ? { type: notice[0], text: notice[1] } : null;
}
