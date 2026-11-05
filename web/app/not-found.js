import Link from "next/link";
import { ErrorScreen } from "./error-screen.js";

export const metadata = { title: "Page introuvable · Anime Notifs" };

export default function NotFound() {
  return (
    <ErrorScreen
      title="Page introuvable"
      text="Cette page n'existe pas (ou plus). Vérifie l'adresse, ou repars de l'accueil."
    >
      <Link href="/" className="btn btn-primary btn-large">
        Retour à l'accueil
      </Link>
      <Link href="/guide" className="btn btn-ghost btn-large">
        Lire le guide
      </Link>
    </ErrorScreen>
  );
}
