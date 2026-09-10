"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "../lib/supabaseServer.js";

function extractPath(input) {
  const trimmed = input.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.pathname.replace(/\/?$/, "/");
  } catch {
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.replace(/\/?$/, "/");
  }
}

export async function addAnime(formData) {
  const rawUrl = formData.get("url");
  const title = formData.get("title");

  if (!rawUrl || !rawUrl.trim()) return;

  const path = extractPath(rawUrl);
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("watchlist_items")
    .insert({ path, title: title?.trim() || null });

  // Un doublon (contrainte unique sur path) n'est pas une vraie erreur pour l'utilisateur.
  if (error && error.code !== "23505") {
    throw new Error(`Impossible d'ajouter la série: ${error.message}`);
  }

  revalidatePath("/");
}

export async function toggleActive(id, currentActive) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("watchlist_items")
    .update({ active: !currentActive })
    .eq("id", id);

  if (error) throw new Error(`Impossible de mettre à jour: ${error.message}`);
  revalidatePath("/");
}

export async function deleteAnime(id) {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("watchlist_items").delete().eq("id", id);

  if (error) throw new Error(`Impossible de supprimer: ${error.message}`);
  revalidatePath("/");
}
