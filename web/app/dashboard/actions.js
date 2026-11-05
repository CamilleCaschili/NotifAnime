"use server";

import { redirect } from "next/navigation";
import { getSession } from "../../lib/supabase.js";
import { normalizeAnimePath } from "../../../shared/animePath.js";
import {
  cleanWebhookUrl,
  isDiscordWebhookUrl,
  getWebhookInfo,
  postWebhook,
  testMessage,
} from "../../../shared/discord.js";

// Toutes ces actions passent par le client Supabase de l'utilisateur : même si
// un id était trafiqué dans le formulaire, la Row Level Security empêche de
// toucher aux données d'un autre compte.

function done(notice) {
  redirect(`/dashboard?notice=${notice}`);
}

async function requireUser() {
  const session = await getSession();
  if (!session.user) redirect("/?notice=login_required");
  return session;
}

// ---------------------------------------------------------------------------
// Séries
// ---------------------------------------------------------------------------

export async function followAnime(formData) {
  const { supabase } = await requireUser();
  const path = normalizeAnimePath(formData.get("url"));
  if (!path) done("invalid_anime_url");

  const { data, error } = await supabase.rpc("follow_anime", { p_path: path });
  if (error) {
    if (error.message.includes("subscription_limit")) done("subscription_limit");
    console.error("follow_anime:", error.message);
    done("error");
  }
  done(data === "already_following" ? "already_following" : "anime_added");
}

export async function setSubscriptionActive(subscriptionId, active) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").update({ active }).eq("id", subscriptionId);
  if (error) {
    console.error("Pause/reprise:", error.message);
    done("error");
  }
  done(active ? "subscription_resumed" : "subscription_paused");
}

export async function unfollowAnime(subscriptionId) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").delete().eq("id", subscriptionId);
  if (error) {
    console.error("Retrait d'une série:", error.message);
    done("error");
  }
  done("anime_removed");
}

// ---------------------------------------------------------------------------
// Salons Discord
// ---------------------------------------------------------------------------

export async function addChannel(formData) {
  const { supabase, user } = await requireUser();
  const url = cleanWebhookUrl(formData.get("webhook_url"));
  const label = String(formData.get("label") ?? "").trim().slice(0, 100) || null;

  if (!isDiscordWebhookUrl(url)) done("invalid_webhook_url");

  // On vérifie auprès de Discord que le webhook existe avant de l'enregistrer.
  const info = await getWebhookInfo(url);
  if (info.status === "gone") done("webhook_not_found");
  if (info.status !== "ok") done("discord_unreachable");

  const { error } = await supabase.from("notification_channels").insert({
    user_id: user.id,
    type: "discord",
    config: { webhook_url: url },
    label: label ?? info.name,
  });

  if (error) {
    if (error.code === "23505") done("webhook_already_added");
    if (error.message.includes("channel_limit")) done("channel_limit");
    console.error("Ajout d'un salon:", error.message);
    done("error");
  }

  await postWebhook(url, testMessage({ isWelcome: true }));
  done("channel_added");
}

export async function testChannel(channelId) {
  const { supabase } = await requireUser();
  const { data: channel } = await supabase
    .from("notification_channels")
    .select("id, config")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) done("error");

  const result = await postWebhook(channel.config?.webhook_url, testMessage());
  if (result === "error") done("discord_unreachable");

  // Un test réussi réactive un salon désactivé ; un webhook supprimé le désactive.
  await supabase.from("notification_channels").update({ active: result === "ok" }).eq("id", channelId);
  done(result === "ok" ? "test_sent" : "webhook_not_found");
}

export async function deleteChannel(channelId) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notification_channels").delete().eq("id", channelId);
  if (error) {
    console.error("Suppression d'un salon:", error.message);
    done("error");
  }
  done("channel_deleted");
}

// ---------------------------------------------------------------------------
// Compte
// ---------------------------------------------------------------------------

export async function deleteAccount(formData) {
  const { supabase } = await requireUser();
  if (formData.get("confirm") !== "yes") done("confirm_required");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("Suppression du compte:", error.message);
    done("error");
  }

  // Le compte n'existe plus : on efface juste les cookies de session.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?notice=account_deleted");
}
