// Adresse actuelle de voiranime affichée sur le site (exemples, astuce DNS).
// Même variable que le scraper : le jour où le domaine change, mettre à jour
// BASE_URL dans Vercel suffit pour que le site ne renvoie pas vers un ancien
// domaine (souvent récupéré par des copies).
export const VOIRANIME_URL = (process.env.BASE_URL || "https://voir-anime.to").replace(/\/+$/, "");
export const VOIRANIME_HOST = new URL(VOIRANIME_URL).host;
