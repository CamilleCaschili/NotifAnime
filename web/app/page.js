import Link from "next/link";
import { getSession } from "../lib/supabase.js";
import { DiscordEmbedPreview, LoginButton, Notice, PrimaryLink } from "./components.js";

export default async function HomePage({ searchParams }) {
  const [{ user }, { notice }] = await Promise.all([getSession(), searchParams]);

  return (
    <main className="page-wide">
      <Notice code={notice} />

      <section className="hero">
        <div className="hero-text">
          <h1>Ne rate plus aucun épisode.</h1>
          <p className="hero-lead">
            Anime Notifs surveille les séries que tu suis sur voiranime et poste un message dans ton serveur
            Discord dès qu'un nouvel épisode sort.
          </p>
          <div className="hero-actions">
            {user ? (
              <PrimaryLink href="/dashboard" large>
                Ouvrir mon tableau de bord
              </PrimaryLink>
            ) : (
              <LoginButton large />
            )}
            <Link href="/guide" className="btn btn-ghost btn-large">
              Lire le guide
            </Link>
          </div>
          <p className="hero-note">Gratuit, sans mot de passe : on utilise ton compte Discord pour te connecter.</p>
        </div>
        <DiscordEmbedPreview />
      </section>

      <section>
        <h2 className="section-title">Comment ça marche</h2>
        <ol className="steps-grid">
          <li>
            <span className="step-number">1</span>
            <h3>Connecte-toi avec Discord</h3>
            <p>Un clic, aucun mot de passe à retenir.</p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>Branche un salon</h3>
            <p>
              Crée un webhook dans le salon de ton choix et colle son adresse. Compte 2 minutes, le{" "}
              <Link href="/guide">guide pas à pas</Link> t'accompagne.
            </p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>Ajoute tes séries</h3>
            <p>Colle le lien de la page voiranime de chaque série. On vérifie les sorties toutes les 6 heures.</p>
          </li>
        </ol>
      </section>

      <section className="faq">
        <h2 className="section-title">Questions fréquentes</h2>
        <details>
          <summary>Il me faut un serveur Discord ?</summary>
          <p>
            Oui, un serveur où tu peux gérer les webhooks. Tu n'en as pas ? Tu peux en créer un rien que pour toi
            en 30 secondes, c'est expliqué dans le <Link href="/guide">guide</Link>.
          </p>
        </details>
        <details>
          <summary>Faut-il inviter un bot sur mon serveur ?</summary>
          <p>
            Non. Un webhook peut seulement poster des messages dans le salon que tu as choisi : il ne lit rien et
            n'a aucun autre accès à ton serveur. Tu peux le supprimer à tout moment depuis Discord.
          </p>
        </details>
        <details>
          <summary>Je viens d'ajouter une série, pourquoi je ne reçois rien ?</summary>
          <p>
            Pour ne pas te spammer, les épisodes déjà sortis sont archivés sans notification lors de la première
            analyse. Tu reçois ensuite un message pour chaque nouvel épisode.
          </p>
        </details>
        <details>
          <summary>voiranime ne s'ouvre pas chez moi, ça marche quand même ?</summary>
          <p>
            Oui : on vérifie les sorties depuis nos serveurs, tes notifications arrivent même si ton fournisseur
            d'accès bloque le site. Pour l'ouvrir toi-même, suis{" "}
            <Link href="/guide#dns">l'astuce du DNS sécurisé</Link>.
          </p>
        </details>
        <details>
          <summary>Quelles données sont conservées ?</summary>
          <p>
            Ce que Discord transmet à la connexion (identifiant, pseudo, avatar, email), tes séries et tes
            webhooks. Tu peux tout supprimer à tout moment depuis ton tableau de bord.
          </p>
        </details>
      </section>
    </main>
  );
}
