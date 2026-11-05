import Link from "next/link";
import "./globals.css";
import { getSession } from "../lib/supabase.js";
import { signOut } from "./auth/actions.js";
import { BellIcon, LoginButton } from "./components.js";

export const metadata = {
  title: "Anime Notifs",
  description: "Reçois une notification Discord dès qu'un nouvel épisode de tes animes sort.",
};

export default async function RootLayout({ children }) {
  const { user } = await getSession();

  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href={user ? "/dashboard" : "/"} className="brand">
              <span className="brand-mark" aria-hidden="true">
                <BellIcon />
              </span>
              Anime Notifs
            </Link>
            <nav className="site-nav">
              <Link href="/guide">
                Guide<span className="hide-sm"> Discord</span>
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="nav-user">
                    {user.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" width={24} height={24} referrerPolicy="no-referrer" />
                    )}
                    <span>{user.name}</span>
                  </Link>
                  <form action={signOut}>
                    <button type="submit" className="link-button">
                      Déconnexion
                    </button>
                  </form>
                </>
              ) : (
                <LoginButton>Se connecter</LoginButton>
              )}
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            Anime Notifs n'héberge aucune vidéo : le site surveille les pages de séries que tu lui indiques et
            t'envoie un message Discord quand un épisode apparaît.
          </p>
        </footer>
      </body>
    </html>
  );
}
