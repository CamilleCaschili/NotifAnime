import "./globals.css";

export const metadata = {
  title: "Anime Notifs",
  description: "Gère ta watchlist d'anime et les notifications d'épisodes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
