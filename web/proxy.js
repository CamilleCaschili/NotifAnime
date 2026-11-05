import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Exécuté avant chaque page (Next 16 : "proxy" remplace "middleware").
// 1. Rafraîchit la session Supabase si son jeton a expiré, et renvoie les
//    nouveaux cookies au navigateur.
// 2. Renvoie vers l'accueil les visiteurs non connectés qui ouvrent /dashboard.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Empêche un cache intermédiaire de servir la session d'un utilisateur à un autre.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Ne rien mettre entre la création du client et cet appel : c'est lui qui
  // rafraîchit la session.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  if (!isLoggedIn && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?notice=login_required";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Pas de session à rafraîchir pour les fichiers statiques (logo, avatar du bot…)
  matcher: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
};
