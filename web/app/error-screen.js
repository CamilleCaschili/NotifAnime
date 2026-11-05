// Écran commun aux pages d'erreur (error.js, global-error.js, not-found.js).
export function ErrorScreen({ title, text, children, digest }) {
  return (
    <main className="error-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={84} height={84} className="error-logo" />
      <h1>{title}</h1>
      <p className="error-text">{text}</p>
      <div className="error-actions">{children}</div>
      {digest && (
        <p className="error-digest">
          Code d'erreur : <code>{digest}</code>
        </p>
      )}
    </main>
  );
}
