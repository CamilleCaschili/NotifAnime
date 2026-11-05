"use client"; // Les pages d'erreur sont forcément des composants client

import { ErrorScreen } from "./error-screen.js";

// Affichée à la place d'une page qui plante (l'en-tête du site reste visible).
// Le détail de l'erreur n'est jamais montré : il est dans les logs Vercel,
// retrouvable grâce au code d'erreur (digest).
export default function Error({ error, retry }) {
  const digest = typeof error?.digest === "string" ? error.digest : undefined;

  return (
    <ErrorScreen
      title="Oups, cette page n'a pas pu s'afficher"
      text="Un souci technique de notre côté, pas du tien. Réessaie dans un instant : si ça continue, reviens un peu plus tard."
      digest={digest}
    >
      <button type="button" className="btn btn-primary btn-large" onClick={() => retry()}>
        Réessayer
      </button>
      <a href="/" className="btn btn-ghost btn-large">
        Retour à l'accueil
      </a>
    </ErrorScreen>
  );
}
