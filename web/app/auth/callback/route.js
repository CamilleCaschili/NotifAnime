import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase.js";

// Discord renvoie ici après la connexion (via Supabase) avec un code à usage
// unique, qu'on échange contre une session (cookies).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
    console.error("Échange du code OAuth:", error.message);
  }

  // Refus sur l'écran Discord, lien expiré, ou ouvert dans un autre navigateur.
  return NextResponse.redirect(`${origin}/?notice=login_failed`);
}
