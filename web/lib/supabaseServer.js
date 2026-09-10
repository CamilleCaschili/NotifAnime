import { createClient } from "@supabase/supabase-js";

// Ce fichier n'est importé que par des Server Components / Server Actions
// (jamais par du code envoyé au navigateur), donc la clé service_role reste
// bien côté serveur uniquement.
export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis.");
  }

  return createClient(url, key);
}
