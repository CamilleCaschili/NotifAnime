import { getSupabaseServer } from "../lib/supabaseServer.js";
import { addAnime, toggleActive, deleteAnime } from "./actions.js";

export const dynamic = "force-dynamic"; // toujours des données fraîches, pas de cache statique

async function getWatchlist() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("id, path, title, active, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function getRecentEpisodes() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("episodes_notified")
    .select("id, title, link, discovered_at, watchlist_items(title, path)")
    .order("discovered_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data || [];
}

export default async function Page() {
  const [watchlist, episodes] = await Promise.all([getWatchlist(), getRecentEpisodes()]);

  return (
    <main>
      <h1>Anime Notifs</h1>
      <p className="subtitle">Gère ta watchlist et consulte les derniers épisodes détectés.</p>

      <section>
        <h2>Ajouter une série</h2>
        <form action={addAnime} className="add-form">
          <input
            type="text"
            name="url"
            placeholder="https://voir-anime.to/anime/nom/"
            required
          />
          <input type="text" name="title" placeholder="Titre (optionnel)" />
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section>
        <h2>Watchlist ({watchlist.length})</h2>
        {watchlist.length === 0 && <p className="empty">Aucune série pour l'instant.</p>}
        {watchlist.map((item) => (
          <div key={item.id} className={`item ${item.active ? "" : "inactive"}`}>
            <div className="item-info">
              <strong>{item.title || item.path}</strong>
              <span>{item.path}</span>
            </div>
            <div className="item-actions">
              <form action={toggleActive.bind(null, item.id, item.active)}>
                <button type="submit">{item.active ? "Mettre en pause" : "Réactiver"}</button>
              </form>
              <form action={deleteAnime.bind(null, item.id)}>
                <button type="submit" className="delete">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Derniers épisodes détectés</h2>
        {episodes.length === 0 && <p className="empty">Rien pour l'instant.</p>}
        {episodes.map((ep) => (
          <div key={ep.id} className="episode">
            <span className="anime-title">{ep.watchlist_items?.title || ep.watchlist_items?.path}</span>
            {" — "}
            <a href={ep.link} target="_blank" rel="noreferrer">
              {ep.title}
            </a>
            <div className="empty">{new Date(ep.discovered_at).toLocaleString("fr-FR")}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
