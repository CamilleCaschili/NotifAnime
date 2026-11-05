import Link from "next/link";
import { getNotice } from "../lib/notices.js";
import { signInWithDiscord } from "./auth/actions.js";

export function BellIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 3c-3.3 0-5.5 2.5-5.5 5.7v3.8L4.6 15.4V17h14.8v-1.6l-1.9-2.9V8.7C17.5 5.5 15.3 3 12 3Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0Z" />
    </svg>
  );
}

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
        <div className="discord-avatar" aria-hidden="true">
          <BellIcon size={22} />
        </div>
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
