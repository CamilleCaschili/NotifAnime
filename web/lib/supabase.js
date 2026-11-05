import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL et SUPABASE_ANON_KEY doivent être définis.");
  }
  return { url, key };
}

/**
 * Client Supabase qui agit AU NOM de l'utilisateur connecté (clé anon + cookie
 * de session) : la Row Level Security de la base limite chaque requête à ses
 * propres données. Pas de clé service_role dans l'app web.
 */
export async function createSupabaseServer() {
  const { url, key } = getEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component, où on ne peut pas écrire de
          // cookie : le proxy (proxy.js) rafraîchit déjà la session.
        }
      },
    },
  });
}

/**
 * Utilisateur connecté (ou null), partagé entre le layout et la page pendant
 * un même rendu. Le JWT est vérifié, pas juste lu dans le cookie.
 */
export const getSession = cache(async () => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null };

  const meta = claims.user_metadata ?? {};
  return {
    supabase,
    user: {
      id: claims.sub,
      email: claims.email ?? null,
      name: meta.custom_claims?.global_name || meta.full_name || meta.name || claims.email || "Toi",
      avatarUrl: meta.avatar_url || null,
    },
  };
});
