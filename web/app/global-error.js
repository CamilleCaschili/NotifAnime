"use client"; // Les pages d'erreur sont forcément des composants client

import "./globals.css";
import { ErrorScreen } from "./error-screen.js";

// Dernier filet de sécurité : remplace tout le site (y compris l'en-tête)
// quand c'est la mise en page elle-même qui plante.
export default function GlobalError({ error, retry }) {
  const digest = typeof error?.digest === "string" ? error.digest : undefined;

  return (
    <html lang="fr">
      <body>
        <title>Erreur · Anime Notifs</title>
        <ErrorScreen
          title="Anime Notifs est momentanément indisponible"
          text="Le site rencontre un problème technique. Réessaie dans quelques minutes."
          digest={digest}
        >
          <button type="button" className="btn btn-primary btn-large" onClick={() => retry()}>
            Réessayer
          </button>
        </ErrorScreen>
      </body>
    </html>
  );
}
