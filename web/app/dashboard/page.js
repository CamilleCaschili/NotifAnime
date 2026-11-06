import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/supabase.js";
import { MAX_CHANNELS, MAX_SUBSCRIPTIONS } from "../../lib/notices.js";
import { titleFromPath } from "../../../shared/animePath.js";
import { maskWebhookUrl } from "../../../shared/discord.js";
import { Notice, Path } from "../components.js";
import { VOIRANIME_URL } from "../../lib/voiranime.js";
import {
  addChannel,
  deleteAccount,
  deleteChannel,
  followAnime,
  setSubscriptionActive,
  testChannel,
  unfollowAnime,
} from "./actions.js";

export const metadata = { title: "Tableau de bord · Anime Notifs" };

function formatDate(value) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

function animeStatus(sub) {
  const anime = sub.animes;
  if (!sub.active) return { text: "En pause", tone: "muted" };
  if (anime.last_error) return { text: `⚠️ ${anime.last_error}`, tone: "danger" };
  if (!anime.last_scraped_at) return { text: "En attente de la première analyse (sous 6 h)", tone: "muted" };
  return { text: `Vérifiée le ${formatDate(anime.last_scraped_at)}`, tone: "ok" };
}

async function loadDashboard(supabase, userId) {
  const [channelsRes, subsRes] = await Promise.all([
    supabase
      .from("notification_channels")
      .select("id, label, config, active, created_at")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("subscriptions")
      .select("id, active, created_at, anime_id, animes(path, title, poster_url, last_scraped_at, last_error)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (channelsRes.error) throw new Error(channelsRes.error.message);
  if (subsRes.error) throw new Error(subsRes.error.message);

  const subscriptions = subsRes.data;
  let episodes = [];
  if (subscriptions.length > 0) {
    const { data, error } = await supabase
      .from("episodes_notified")
      .select("id, anime_id, title, link, discovered_at")
      .in(
        "anime_id",
        subscriptions.map((s) => s.anime_id)
      )
      .eq("is_backlog", false)
      .order("discovered_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    episodes = data;
  }

  return { channels: channelsRes.data, subscriptions, episodes };
}

export default async function DashboardPage({ searchParams }) {
  const [{ supabase, user }, { notice }] = await Promise.all([getSession(), searchParams]);
  if (!user) redirect("/?notice=login_required");

  const { channels, subscriptions, episodes } = await loadDashboard(supabase, user.id);
  const titleByAnime = new Map(
    subscriptions.map((s) => [s.anime_id, s.animes.title || titleFromPath(s.animes.path)])
  );
  const activeChannels = channels.filter((c) => c.active);
  const needsOnboarding = activeChannels.length === 0 || subscriptions.length === 0;

  return (
    <main>
      <h1>Salut {user.name} 👋</h1>
      <p className="subtitle">Gère tes salons Discord et les séries que tu suis.</p>

      <Notice code={notice} />

      {needsOnboarding && (
        <ol className="checklist">
          <li className={activeChannels.length > 0 ? "done" : ""}>
            <a href="#salons">Relie un salon Discord</a> (2 minutes)
          </li>
          <li className={subscriptions.length > 0 ? "done" : ""}>
            <a href="#series">Ajoute ta première série</a>
          </li>
        </ol>
      )}

      <section id="salons">
        <div className="section-head">
          <h2>
            Salons Discord ({channels.length}/{MAX_CHANNELS})
          </h2>
          <Link href="/guide" className="section-link">
            Guide en images
          </Link>
        </div>

        {channels.map((channel) => (
          <div key={channel.id} className={`item ${channel.active ? "" : "inactive"}`}>
            <div className="item-info">
              <strong>{channel.label || "Salon Discord"}</strong>
              <span>{maskWebhookUrl(channel.config?.webhook_url)}</span>
              {!channel.active && (
                <span className="status status-danger">
                  Désactivé : ce webhook n'existe plus côté Discord. Déconnecte-le et crée-en un nouveau.
                </span>
              )}
            </div>
            <div className="item-actions">
              <form action={testChannel.bind(null, channel.id)}>
                <button type="submit">Tester</button>
              </form>
              <form action={deleteChannel.bind(null, channel.id)}>
                <button type="submit" className="delete">
                  Déconnecter
                </button>
              </form>
            </div>
          </div>
        ))}

        {activeChannels.length === 0 && (
          <div className="setup-help">
            <p>
              <strong>Où trouver ce lien ?</strong> Il se crée dans Discord :
            </p>
            <ol>
              <li>
                Sur ton serveur : <Path items={["Paramètres du serveur", "Intégrations", "Webhooks", "Nouveau webhook"]} />
              </li>
              <li>
                Ouvre le webhook créé, puis <span className="ui-chip">Copier l'URL du webhook</span>
              </li>
              <li>
                Colle le lien ci-dessous et clique sur <span className="ui-chip">Connecter</span>
              </li>
            </ol>
            <p>
              Pas de serveur, ou tu ne trouves pas ? <Link href="/guide">Suis le guide en images</Link>, pour
              ordinateur et téléphone.
            </p>
          </div>
        )}

        {channels.length < MAX_CHANNELS && (
          <form action={addChannel} className="add-form">
            <input
              type="url"
              name="webhook_url"
              placeholder="https://discord.com/api/webhooks/…"
              aria-label="URL du webhook Discord"
              maxLength={300}
              required
            />
            <input type="text" name="label" placeholder="Nom du salon (optionnel)" aria-label="Nom du salon" maxLength={100} />
            <button type="submit">Connecter</button>
          </form>
        )}
      </section>

      <section id="series">
        <h2>Ajouter une série</h2>
        <form action={followAnime} className="add-form">
          <input
            type="text"
            name="url"
            placeholder={`${VOIRANIME_URL}/anime/nom-de-la-serie/`}
            aria-label="Lien de la série sur voiranime"
            maxLength={300}
            required
          />
          <button type="submit" disabled={subscriptions.length >= MAX_SUBSCRIPTIONS}>
            Suivre
          </button>
        </form>
        <p className="hint">
          Colle le lien de la page de la série sur voiranime (un lien d'épisode marche aussi). voiranime ne
          s'ouvre pas chez toi ? <Link href="/guide#dns">Voir l'astuce</Link>.
        </p>
      </section>

      <section>
        <h2>
          Mes séries ({subscriptions.length}/{MAX_SUBSCRIPTIONS})
        </h2>
        {subscriptions.length === 0 && <p className="empty">Aucune série pour l'instant.</p>}
        {subscriptions.map((sub) => {
          const status = animeStatus(sub);
          return (
            <div key={sub.id} className={`item ${sub.active ? "" : "inactive"}`}>
              <div className="item-main">
                {sub.animes.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="poster" src={sub.animes.poster_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="poster poster-empty" aria-hidden="true" />
                )}
                <div className="item-info">
                  <strong>{titleByAnime.get(sub.anime_id)}</strong>
                  <span>{sub.animes.path}</span>
                  <span className={`status status-${status.tone}`}>{status.text}</span>
                </div>
              </div>
              <div className="item-actions">
                <form action={setSubscriptionActive.bind(null, sub.id, !sub.active)}>
                  <button type="submit">{sub.active ? "Pause" : "Reprendre"}</button>
                </form>
                <form action={unfollowAnime.bind(null, sub.id)}>
                  <button type="submit" className="delete">
                    Retirer
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2>Derniers épisodes détectés</h2>
        {episodes.length === 0 && (
          <p className="empty">Rien pour l'instant : les nouveaux épisodes de tes séries apparaîtront ici.</p>
        )}
        {episodes.map((ep) => (
          <div key={ep.id} className="episode">
            <span className="anime-title">{titleByAnime.get(ep.anime_id)}</span>
            {" — "}
            {ep.link ? (
              <a href={ep.link} target="_blank" rel="noreferrer">
                {ep.title}
              </a>
            ) : (
              ep.title
            )}
            <div className="empty">{formatDate(ep.discovered_at)}</div>
          </div>
        ))}
      </section>

      <section className="danger-zone">
        <h2>Compte</h2>
        <p className="hint">
          Connecté avec Discord{user.email ? ` (${user.email})` : ""}.
        </p>
        <details>
          <summary>Supprimer mon compte</summary>
          <form action={deleteAccount} className="delete-account">
            <p>
              Ton compte, tes séries et tes salons connectés seront supprimés définitivement. Les webhooks
              eux-mêmes restent dans Discord : supprime-les là-bas si tu ne t'en sers plus.
            </p>
            <label>
              <input type="checkbox" name="confirm" value="yes" required /> Je comprends, c'est définitif
            </label>
            <button type="submit" className="btn btn-danger">
              Supprimer mon compte
            </button>
          </form>
        </details>
      </section>
    </main>
  );
}
