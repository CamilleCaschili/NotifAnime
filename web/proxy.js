import { NextResponse } from "next/server";

// Authentification HTTP Basic très simple : le navigateur affiche une popup
// login/mot de passe native. Suffisant pour un usage perso, pas un vrai
// système de comptes (pas besoin vu qu'il n'y a qu'un seul utilisateur).
// (Next 16 : "proxy" remplace l'ancienne convention "middleware".)
export function proxy(request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    // On coupe au premier ":" seulement : le mot de passe peut en contenir.
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pwd = decoded.slice(sep + 1);

    if (sep !== -1 && user === process.env.APP_USERNAME && pwd === process.env.APP_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentification requise.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="anime-notifs"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
