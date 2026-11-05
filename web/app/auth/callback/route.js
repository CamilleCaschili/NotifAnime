import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase.js";

// Discord renvoie ici après la connexion (via Supabase) avec un code à usage
// unique, qu'on échange contre une session (cookies).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const fail = (notice, details) => {
    // Détail complet dans les logs Vercel (Runtime Logs), message simple à l'écran.
    console.error(`Connexion Discord échouée (${notice}):`, details);
    return NextResponse.redirect(`${origin}/?notice=${notice}`);
  };

  // Erreur renvoyée par Discord ou Supabase (refus, configuration, email manquant…)
  const error = searchParams.get("error");
  if (error) {
    const description = searchParams.get("error_description") || "";
    if (error === "access_denied") return fail("login_cancelled", description || error);
    if (/email/i.test(description)) return fail("login_email_required", description);
    return fail("login_failed", `${error}: ${description}`);
  }

  const code = searchParams.get("code");
  if (!code) return fail("login_failed", "aucun code dans l'URL de retour");

  const supabase = await createSupabaseServer();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    // Le plus souvent : connexion commencée dans un autre navigateur / onglet
    // privé, ou lien déjà utilisé.
    return fail("login_failed", `échange du code: ${exchangeError.code ?? ""} ${exchangeError.message}`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
