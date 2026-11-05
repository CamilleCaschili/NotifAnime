"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../lib/supabase.js";

async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithDiscord() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error || !data?.url) {
    console.error("Connexion Discord:", error?.message);
    redirect("/?notice=login_failed");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
