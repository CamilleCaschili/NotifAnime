import Link from "next/link";
import { getSession } from "../../lib/supabase.js";
import { LoginButton, PrimaryLink } from "../components.js";
import { MAX_CHANNELS } from "../../lib/notices.js";

export const metadata = {
  title: "Guide : recevoir les notifs sur Discord · Anime Notifs",
  description: "Créer un webhook Discord et le connecter à Anime Notifs, étape par étape.",
};

function Path({ items }) {
  return (
    <span className="ui-path">
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 && <span className="ui-path-sep">›</span>}
          <span className="ui-chip">{item}</span>
        </span>
      ))}
    </span>
  );
}

/** Illustration simplifiée de l'écran Intégrations > Webhooks d'un salon Discord. */
function WebhookSettingsMock() {
  return (
    <figure className="discord-settings" aria-label="Illustration de l'écran Webhooks de Discord">
      <div className="ds-sidebar">
        <span className="ds-sidebar-title"># anime-notifs</span>
        <span>Vue d'ensemble</span>
        <span>Permissions</span>
        <span>Invitations</span>
        <span className="ds-active">Intégrations</span>
      </div>
      <div className="ds-main">
        <span className="ds-heading">Webhooks</span>
        <span className="ds-button ds-button-secondary">Nouveau webhook</span>
        <div className="ds-webhook">
          <div className="ds-webhook-avatar" aria-hidden="true" />
          <div className="ds-webhook-fields">
            <span className="ds-label">Nom</span>
            <span className="ds-input">Captain Hook</span>
            <span className="ds-label">Salon</span>
            <span className="ds-input"># anime-notifs</span>
          </div>
        </div>
        <div className="ds-actions">
          <span className="ds-button ds-highlight">Copier l'URL du webhook</span>
          <span className="ds-link-danger">Supprimer le webhook</span>
        </div>
      </div>
      <figcaption>Illustration simplifiée : l'interface de Discord peut varier légèrement.</figcaption>
    </figure>
  );
}

export default async function GuidePage() {
  const { user } = await getSession();

  return (
    <main className="guide">
      <h1>Recevoir les notifs dans ton serveur Discord</h1>
      <p className="lead">
        Anime Notifs poste ses messages grâce à un <strong>webhook</strong> : une adresse propre à un salon, qui
        permet uniquement d'y publier des messages. Pas de bot à inviter, aucun accès au reste de ton serveur.
        Compte 2 minutes.
      </p>

      <aside className="callout">
        <strong>Ce qu'il te faut :</strong> un serveur Discord où tu as la permission « Gérer les webhooks » (si
        c'est toi qui as créé le serveur, c'est bon).
        <br />
        Pas de serveur ? Dans Discord, clique sur <span className="ui-chip">+</span> en bas de la liste des
        serveurs, puis <span className="ui-chip">Créer le mien</span>. Il peut rester rien qu'à toi.
      </aside>

      <ol className="guide-steps">
        <li id="salon">
          <h2>Choisis le salon</h2>
          <p>
            Le plus simple : crée un salon textuel dédié, par exemple <code>#anime-notifs</code>. Un salon
            existant fonctionne aussi.
          </p>
        </li>

        <li id="parametres">
          <h2>Ouvre les paramètres du salon</h2>
          <p>
            <strong>Sur ordinateur :</strong> survole le salon et clique sur la roue dentée ⚙️{" "}
            <span className="ui-chip">Modifier le salon</span>.
          </p>
          <p>
            <strong>Sur mobile :</strong> appui long sur le salon, puis{" "}
            <span className="ui-chip">Modifier le salon</span>. C'est plus confortable sur ordinateur ou sur{" "}
            <a href="https://discord.com/app" target="_blank" rel="noreferrer">
              discord.com/app
            </a>
            , mais ça marche aussi.
          </p>
        </li>

        <li id="webhook">
          <h2>Crée le webhook</h2>
          <p>
            Va dans <Path items={["Intégrations", "Webhooks", "Nouveau webhook"]} />.
          </p>
          <p>
            Discord crée un webhook avec un nom au hasard (genre « Captain Hook »). Pas besoin de le renommer
            ni de changer son avatar : nos messages s'affichent toujours au nom d'<strong>Anime Notifs</strong>,
            avec notre logo. Clique simplement dessus pour l'ouvrir et vérifie que le bon salon est
            sélectionné.
          </p>
          <WebhookSettingsMock />
        </li>

        <li id="copier">
          <h2>Copie l'URL du webhook</h2>
          <p>
            Clique sur <span className="ui-chip">Copier l'URL du webhook</span>. Elle ressemble à ceci :
          </p>
          <pre className="url-example">https://discord.com/api/webhooks/1234567890123456789/AbCdEf…</pre>
          <p className="warning">
            ⚠️ Garde cette adresse pour toi : n'importe qui la connaissant peut poster dans ton salon.
          </p>
        </li>

        <li id="connecter">
          <h2>Colle-la sur Anime Notifs</h2>
          <p>
            Dans ton <Link href="/dashboard">tableau de bord</Link>, section « Salons Discord », colle l'URL,
            donne-lui un nom si tu veux (par exemple « Serveur des potes – #anime »), puis clique sur{" "}
            <span className="ui-chip">Connecter</span>.
          </p>
          <p>
            Un message <strong>« ✅ Salon connecté à Anime Notifs »</strong> apparaît aussitôt dans ton salon.
          </p>
        </li>

        <li id="series">
          <h2>Ajoute tes séries</h2>
          <p>
            Sur voiranime, ouvre la page de la série et copie son adresse, par exemple{" "}
            <code>https://voir-anime.to/anime/wandance/</code>. Colle-la dans « Ajouter une série ». Un lien
            d'épisode marche aussi : on retrouve la série tout seuls.
          </p>
          <p>
            À la première analyse, les épisodes déjà sortis sont archivés <strong>sans notification</strong>,
            pour ne pas te spammer. Ensuite, chaque nouvel épisode t'est annoncé. Les sorties sont vérifiées
            toutes les 6 heures.
          </p>
        </li>
      </ol>

      <div className="guide-cta">
        {user ? (
          <PrimaryLink href="/dashboard" large>
            Aller au tableau de bord
          </PrimaryLink>
        ) : (
          <LoginButton large>Se connecter avec Discord pour commencer</LoginButton>
        )}
      </div>

      <section className="faq">
        <h2 className="section-title">Bon à savoir</h2>
        <details>
          <summary>Plusieurs salons ou plusieurs serveurs ?</summary>
          <p>
            Tu peux connecter jusqu'à {MAX_CHANNELS} salons : chaque nouvel épisode est posté dans chacun d'eux.
            Si vous êtes plusieurs à brancher le même salon avec vos comptes, un épisode que vous suivez tous
            n'y est posté qu'une seule fois.
          </p>
        </details>
        <details>
          <summary>Je ne vois pas « Intégrations » ou « Webhooks »</summary>
          <p>
            Il te manque la permission « Gérer les webhooks » sur ce serveur. Demande à un admin de te la donner,
            ou utilise un serveur à toi.
          </p>
        </details>
        <details>
          <summary>Le site me dit que l'URL n'est pas valide</summary>
          <p>
            Copie-la avec le bouton « Copier l'URL du webhook » plutôt qu'à la main : elle doit commencer par{" "}
            <code>https://discord.com/api/webhooks/</code>.
          </p>
        </details>
        <details>
          <summary>Je n'ai reçu aucune notification</summary>
          <p>
            Juste après l'ajout d'une série, c'est normal : les épisodes déjà sortis ne sont pas annoncés, et la
            vérification a lieu toutes les 6 heures. Pour vérifier que ton salon reçoit bien les messages, utilise
            le bouton « Tester » du tableau de bord.
          </p>
        </details>
        <details>
          <summary>Mon salon est marqué « Désactivé »</summary>
          <p>
            Le webhook a été supprimé côté Discord. Déconnecte ce salon dans le tableau de bord et recommence le
            guide pour en créer un nouveau.
          </p>
        </details>
        <details>
          <summary>Comment arrêter les notifications ?</summary>
          <p>
            Mets une série en pause, déconnecte le salon dans le tableau de bord, ou supprime simplement le
            webhook dans Discord (<Path items={["Intégrations", "Webhooks", "Supprimer le webhook"]} />).
          </p>
        </details>
      </section>
    </main>
  );
}
