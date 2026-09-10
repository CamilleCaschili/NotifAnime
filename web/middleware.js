import { NextResponse } from "next/server";

// Authentification HTTP Basic très simple : le navigateur affiche une popup
// login/mot de passe native. Suffisant pour un usage perso, pas un vrai
// système de comptes (pas besoin vu qu'il n'y a qu'un seul utilisateur).
export function middleware(request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.split(" ")[1];
    const [user, pwd] = atob(encoded).split(":");

    if (user === process.env.APP_USERNAME && pwd === process.env.APP_PASSWORD) {
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