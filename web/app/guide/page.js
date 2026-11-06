import Link from "next/link";
import { getSession } from "../../lib/supabase.js";
import { LoginButton, Path, PrimaryLink } from "../components.js";
import { MAX_CHANNELS } from "../../lib/notices.js";
import { VOIRANIME_HOST, VOIRANIME_URL } from "../../lib/voiranime.js";

export const metadata = {
  title: "Guide : recevoir les notifs sur Discord · Anime Notifs",
  description: "Créer un webhook Discord et le connecter à Anime Notifs, étape par étape.",
};

// Le guide affiche les consignes ordinateur OU téléphone. Sans choix du
// visiteur, la largeur d'écran décide ; ensuite c'est son choix (CSS :has,
// aucun JavaScript). Voir .device-switch dans globals.css.
function DeviceSwitch() {
  return (
    <div className="device-switch" role="radiogroup" aria-label="Appareil utilisé pour Discord">
      <span className="device-switch-label">J'utilise Discord sur :</span>
      <input type="radio" name="device" id="device-desktop" className="sr-only" />
      <label htmlFor="device-desktop">Ordinateur</label>
      <input type="radio" name="device" id="device-mobile" className="sr-only" />
      <label htmlFor="device-mobile">Téléphone</label>
    </div>
  );
}

// `inline` : à utiliser à l'intérieur d'un paragraphe (un <div> y est interdit).
const Desktop = ({ children, inline = false }) =>
  inline ? <span className="only-desktop">{children}</span> : <div className="only-desktop">{children}</div>;
const Mobile = ({ children, inline = false }) =>
  inline ? <span className="only-mobile">{children}</span> : <div className="only-mobile">{children}</div>;

function Where({ children }) {
  return <span className="step-where">{children}</span>;
}

/* ------------------------------------------------------------------------
 * Maquettes simplifiées de Discord. Le bouton à toucher est entouré.
 * --------------------------------------------------------------------- */

function Mock({ children, caption = "Illustration simplifiée : l'interface de Discord peut varier un peu." }) {
  return (
    <figure className="mock">
      <div className="mock-screens">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** Colonne des serveurs, avec le bouton « + ». */
function ServerRail({ plus = false }) {
  return (
    <div className="ds-rail" aria-hidden="true">
      <span className="ds-rail-icon ds-rail-home" />
      <span className="ds-rail-sep" />
      <span className="ds-rail-icon">AB</span>
      <span className="ds-rail-icon">Jo</span>
      <span className={`ds-rail-icon ds-rail-plus${plus ? " ds-highlight" : ""}`}>+</span>
    </div>
  );
}

function CreateServerMock() {
  return (
    <Mock>
      <div className="mock-window mock-create">
        <ServerRail plus />
        <div className="ds-modal">
          <span className="ds-heading">Crée ton serveur</span>
          <span className="ds-option ds-highlight">Créer le mien</span>
          <span className="ds-muted">Ou commence avec un modèle</span>
          <span className="ds-option">Jeux</span>
          <span className="ds-option">Amis</span>
        </div>
      </div>
    </Mock>
  );
}

function ServerMenuDesktopMock() {
  return (
    <Mock>
      <div className="mock-window">
        <ServerRail />
        <div className="ds-channels">
          <span className="ds-server-name">Mon serveur ▾</span>
          <div className="ds-menu">
            <span>Booster le serveur</span>
            <span>Inviter des gens</span>
            <span className="ds-highlight">Paramètres du serveur</span>
            <span>Créer un salon</span>
          </div>
        </div>
      </div>
    </Mock>
  );
}

function SettingsSidebar() {
  return (
    <div className="ds-sidebar">
      <span className="ds-sidebar-title">Mon serveur</span>
      <span>Vue d'ensemble</span>
      <span>Rôles</span>
      <span>Emojis</span>
      <span className="ds-active">Intégrations</span>
    </div>
  );
}

function WebhooksDesktopMock() {
  return (
    <Mock>
      <div className="mock-window mock-settings">
        <SettingsSidebar />
        <div className="ds-main">
          <span className="ds-heading">Intégrations › Webhooks</span>
          <span className="ds-button ds-highlight">Nouveau webhook</span>
          <span className="ds-muted">Les webhooks créés apparaissent ici.</span>
        </div>
      </div>
    </Mock>
  );
}

function CopyUrlDesktopMock() {
  return (
    <Mock>
      <div className="mock-window mock-settings">
        <SettingsSidebar />
        <div className="ds-main">
          <span className="ds-heading">Intégrations › Webhooks</span>
          <div className="ds-webhook">
            <div className="ds-webhook-avatar" aria-hidden="true" />
            <div className="ds-webhook-fields">
              <span className="ds-label">Nom</span>
              <span className="ds-input">Captain Hook</span>
              <span className="ds-label">Salon</span>
              <span className="ds-input"># général ▾</span>
            </div>
          </div>
          <div className="ds-actions">
            <span className="ds-button ds-button-secondary ds-highlight">Copier l'URL du webhook</span>
            <span className="ds-link-danger">Supprimer le webhook</span>
          </div>
        </div>
      </div>
    </Mock>
  );
}

/** Écran de téléphone : un titre et une liste de lignes, dont `highlight` est entourée. */
function Phone({ title, rows, highlight, children }) {
  return (
    <div className="phone">
      <span className="phone-title">{title}</span>
      {rows && (
        <div className="phone-list">
          {rows.map((row) => (
            <span key={row} className={`phone-row${row === highlight ? " ds-highlight" : ""}`}>
              {row}
              <span aria-hidden="true">›</span>
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function ServerMenuMobileMock() {
  return (
    <Mock>
      <Phone title="Mon serveur ›">
        <div className="phone-actions">
          <span>Boost</span>
          <span>Inviter</span>
          <span>Notifs</span>
          <span className="ds-highlight">⚙️ Paramètres</span>
        </div>
      </Phone>
    </Mock>
  );
}

function WebhooksMobileMock() {
  return (
    <Mock>
      <Phone title="Paramètres" rows={["Vue d'ensemble", "Rôles", "Emojis", "Intégrations"]} highlight="Intégrations" />
      <Phone title="‹ Intégrations" rows={["Webhooks"]} highlight="Webhooks" />
      <Phone title="‹ Webhooks">
        <span className="phone-button ds-highlight">Nouveau webhook</span>
      </Phone>
    </Mock>
  );
}

function CopyUrlMobileMock() {
  return (
    <Mock>
      <Phone title="‹ Captain Hook">
        <div className="ds-webhook-avatar phone-avatar" aria-hidden="true" />
        <span className="ds-label">Nom</span>
        <span className="ds-input">Captain Hook</span>
        <span className="ds-label">Salon</span>
        <span className="ds-input"># général ›</span>
        <span className="phone-button ds-highlight">Copier l'URL du webhook</span>
      </Phone>
    </Mock>
  );
}

/** Astuce pour ouvrir voiranime quand le fournisseur d'accès bloque son adresse. */
function DnsTip() {
  return (
    <aside className="callout dns-tip" id="dns">
      <strong>voiranime ne s'ouvre pas chez toi ?</strong>
      <p>
        Certains fournisseurs d'accès bloquent son adresse au niveau de leur DNS, l'annuaire qui traduit le nom
        d'un site en adresse : le site fonctionne, mais ta box refuse de le trouver. Tes notifications ne sont
        pas concernées, on vérifie les sorties depuis nos serveurs. Pour l'ouvrir toi-même, active le{" "}
        <strong>DNS sécurisé</strong> de ton navigateur :
      </p>
      <ul>
        <li>
          <strong>Chrome / Edge :</strong>{" "}
          <Path items={["Paramètres", "Confidentialité et sécurité", "Sécurité", "Utiliser un DNS sécurisé"]} />,
          puis choisis Cloudflare (1.1.1.1) ou Google.
        </li>
        <li>
          <strong>Firefox :</strong> <Path items={["Paramètres", "Vie privée et sécurité", "DNS via HTTPS"]} />,
          puis « Protection augmentée » avec Cloudflare.
        </li>
        <li>
          <strong>Android :</strong> <Path items={["Paramètres", "Réseau et Internet", "DNS privé"]} />, puis
          saisis <code>one.one.one.one</code>.
        </li>
        <li>
          <strong>iPhone :</strong> installe l'appli « 1.1.1.1 » de Cloudflare et active-la.
        </li>
      </ul>
      <p>
        Redémarre ensuite ton navigateur. Méfie-toi des autres adresses trouvées sur les moteurs de recherche :
        ce sont souvent des copies pleines de pubs. L'adresse utilisée par Anime Notifs est{" "}
        <code>{VOIRANIME_HOST}</code>.
      </p>
    </aside>
  );
}

export default async function GuidePage() {
  const { user } = await getSession();

  return (
    <main className="guide">
      <h1>Recevoir les notifs sur Discord</h1>
      <p className="lead">
        Pour poster dans ton serveur, Anime Notifs a besoin d'un <strong>lien secret</strong> que Discord appelle
        un « webhook ». Tu le crées dans Discord, tu le colles ici, et c'est fini. Compte 2 minutes.
      </p>

      <DeviceSwitch />

      <ol className="guide-steps">
        <li id="serveur">
          <Where>Dans Discord</Where>
          <h2>Aie un serveur Discord à toi</h2>
          <p>
            Tu as déjà créé ton propre serveur ? <a href="#parametres">Passe à l'étape 2</a>. Sinon, crée-en un :
            c'est gratuit, ça prend 30 secondes, et personne d'autre que toi n'y aura accès.
          </p>
          <Desktop>
            <p>
              Dans la colonne des serveurs, tout à gauche, clique sur le <span className="ui-chip">+</span> en
              bas, puis <Path items={["Créer le mien", "Pour moi et mes amis"]} />. Donne-lui un nom et clique sur{" "}
              <span className="ui-chip">Créer</span>.
            </p>
          </Desktop>
          <Mobile>
            <p>
              Dans la colonne des serveurs, à gauche de l'écran, touche le <span className="ui-chip">+</span> en
              bas, puis <Path items={["Créer le mien", "Pour moi et mes amis"]} />. Donne-lui un nom et touche{" "}
              <span className="ui-chip">Créer</span>.
            </p>
          </Mobile>
          <CreateServerMock />
          <p className="step-note">
            Le serveur d'un ami marche aussi, s'il t'a donné la permission « Gérer les webhooks ».
          </p>
        </li>

        <li id="parametres">
          <Where>Dans Discord</Where>
          <h2>Ouvre les paramètres du serveur</h2>
          <Desktop>
            <p>
              Ouvre ton serveur, clique sur <strong>son nom</strong> en haut à gauche, puis sur{" "}
              <span className="ui-chip">Paramètres du serveur</span>.
            </p>
            <ServerMenuDesktopMock />
          </Desktop>
          <Mobile>
            <p>
              Ouvre ton serveur, touche <strong>son nom</strong> tout en haut, puis{" "}
              <span className="ui-chip">Paramètres</span> (la roue dentée).
            </p>
            <ServerMenuMobileMock />
          </Mobile>
        </li>

        <li id="webhook">
          <Where>Dans Discord</Where>
          <h2>Crée le webhook</h2>
          <p>
            Va dans <Path items={["Intégrations", "Webhooks", "Nouveau webhook"]} />. Si Discord
            propose directement <span className="ui-chip">Créer un webhook</span>, c'est pareil.
          </p>
          <Desktop>
            <WebhooksDesktopMock />
          </Desktop>
          <Mobile>
            <WebhooksMobileMock />
          </Mobile>
          <p className="step-note">
            Le webhook reçoit un nom au hasard, comme « Captain Hook » ou « Spidey Bot ». C'est normal, ne
            touche à rien : nos messages s'afficheront au nom d'<strong>Anime Notifs</strong>.
          </p>
        </li>

        <li id="copier">
          <Where>Dans Discord</Where>
          <h2>Copie son lien</h2>
          <Desktop>
            <p>
              Clique sur le webhook pour l'ouvrir. La ligne <strong>Salon</strong> indique où arriveront les notifs
              (<code># général</code> convient très bien). Si tu en choisis un autre, clique sur{" "}
              <span className="ui-chip">Enregistrer les modifications</span> en bas de l'écran.
            </p>
            <p>
              Puis clique sur <span className="ui-chip">Copier l'URL du webhook</span>.
            </p>
            <CopyUrlDesktopMock />
          </Desktop>
          <Mobile>
            <p>
              Touche le webhook pour l'ouvrir. La ligne <strong>Salon</strong> indique où arriveront les notifs
              (<code># général</code> convient très bien). Si tu en choisis un autre, touche{" "}
              <span className="ui-chip">Enregistrer</span>.
            </p>
            <p>
              Puis touche <span className="ui-chip">Copier l'URL du webhook</span>.
            </p>
            <CopyUrlMobileMock />
          </Mobile>
          <p className="warning">
            ⚠️ Ne partage ce lien avec personne : n'importe qui le connaissant peut écrire dans ton salon.
          </p>
        </li>

        <li id="connecter">
          <Where>Sur Anime Notifs</Where>
          <h2>Colle le lien dans ton tableau de bord</h2>
          {!user && (
            <div className="step-login">
              <p>Connecte-toi avec ton compte Discord : tu arrives directement sur ton tableau de bord.</p>
              <LoginButton />
            </div>
          )}
          <p>
            Dans la case <strong>« Salons Discord »</strong>, colle le lien
            <Mobile inline> (appui long dans la case, puis Coller)</Mobile>{" "}
            et clique sur <span className="ui-chip">Connecter</span>.
          </p>
          <p>
            C'est réussi quand le message <strong>« ✅ Salon connecté à Anime Notifs »</strong> apparaît dans ton
            salon Discord.
          </p>
        </li>

        <li id="series">
          <Where>Sur voiranime, puis Anime Notifs</Where>
          <h2>Ajoute tes séries</h2>
          <p>
            Sur voiranime, ouvre la page d'une série que tu regardes et copie son adresse, dans la barre du
            navigateur. Elle ressemble à <code>{VOIRANIME_URL}/anime/wandance/</code>. Un lien d'épisode marche
            aussi.
          </p>
          <p>
            Dans ton tableau de bord, colle-la dans <strong>« Ajouter une série »</strong> et clique sur{" "}
            <span className="ui-chip">Suivre</span>. Recommence pour chaque série.
          </p>
          <p className="step-note">
            Pour ne pas te spammer, les épisodes déjà sortis ne sont pas annoncés : ta première notif arrivera au
            prochain épisode. On vérifie les sorties toutes les 6 heures.
          </p>
          <DnsTip />
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
        <h2 className="section-title">Un souci ?</h2>
        <details>
          <summary>Je ne vois pas « Paramètres du serveur » ou « Intégrations »</summary>
          <p>
            Tu n'as pas les droits sur ce serveur (seul son créateur ou un admin les a). Crée ton propre serveur
            (<a href="#serveur">étape 1</a>) ou demande à un admin la permission « Gérer les webhooks ».
          </p>
        </details>
        <details>
          <summary>Le site me dit que le lien n'est pas valide</summary>
          <p>
            Copie-le avec le bouton « Copier l'URL du webhook » plutôt qu'à la main, et colle-le tel quel : il doit
            commencer par <code>https://discord.com/api/webhooks/</code>. Le lien d'invitation du serveur
            (discord.gg/…) ne marche pas.
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
          <summary>voiranime ne s'ouvre pas chez moi</summary>
          <p>
            Ton fournisseur d'accès bloque sûrement son adresse : voir{" "}
            <a href="#dns">l'astuce du DNS sécurisé</a>. Tes notifications, elles, continuent d'arriver.
          </p>
        </details>
        <details>
          <summary>Mon salon est marqué « Désactivé »</summary>
          <p>
            Le webhook a été supprimé côté Discord. Déconnecte ce salon dans le tableau de bord et recommence à
            l'<a href="#webhook">étape 3</a> pour en créer un nouveau.
          </p>
        </details>
        <details>
          <summary>Plusieurs salons ou plusieurs serveurs ?</summary>
          <p>
            Tu peux connecter jusqu'à {MAX_CHANNELS} salons : chaque nouvel épisode est posté dans chacun d'eux.
            Si vous êtes plusieurs à brancher le même salon avec vos comptes, un épisode que vous suivez tous
            n'y est posté qu'une seule fois.
          </p>
        </details>
        <details>
          <summary>C'est sans risque pour mon serveur ?</summary>
          <p>
            Oui. Un webhook peut seulement poster des messages dans le salon choisi : il ne lit rien et n'a aucun
            autre accès à ton serveur. Pas de bot à inviter.
          </p>
        </details>
        <details>
          <summary>Comment arrêter les notifications ?</summary>
          <p>
            Mets une série en pause, déconnecte le salon dans le <Link href="/dashboard">tableau de bord</Link>, ou
            supprime simplement le webhook dans Discord (
            <Path items={["Intégrations", "Webhooks", "Supprimer le webhook"]} />).
          </p>
        </details>
      </section>
    </main>
  );
}
