import Link from "next/link";
import { getNotice } from "../lib/notices.js";
import { signInWithDiscord } from "./auth/actions.js";

export function Notice({ code }) {
  const notice = getNotice(code);
  if (!notice) return null;
  return (
    <p className={`notice notice-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
      {notice.text}
    </p>
  );
}

export function LoginButton({ children = "Se connecter avec Discord", large = false }) {
  return (
    <form action={signInWithDiscord}>
      <button type="submit" className={`btn btn-discord${large ? " btn-large" : ""}`}>
        {children}
      </button>
    </form>
  );
}

/** Chemin de menus à suivre, ex. Paramètres › Intégrations. */
export function Path({ items }) {
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

export function PrimaryLink({ href, children, large = false }) {
  return (
    <Link href={href} className={`btn btn-primary${large ? " btn-large" : ""}`}>
      {children}
    </Link>
  );
}

/** Aperçu d'une notification telle qu'elle apparaît dans Discord. */
export function DiscordEmbedPreview() {
  return (
    <div className="discord-preview" aria-label="Exemple de notification Discord">
      <div className="discord-message">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="discord-avatar" src="/bot-avatar.png" alt="" width={40} height={40} />
        <div className="discord-body">
          <div className="discord-author">
            Anime Notifs <span className="discord-bot-tag">APP</span>
            <span className="discord-time">Aujourd'hui à 18:02</span>
          </div>
          <div className="discord-embed">
            <div className="discord-embed-content">
              <span className="discord-embed-title">Wandance – Épisode 12 VOSTFR</span>
              <span className="discord-embed-desc">
                Nouvel épisode de <strong>Wandance</strong>
              </span>
              <span className="discord-embed-footer">Anime Notifs</span>
            </div>
            <div className="discord-embed-thumb" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
