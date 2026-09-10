import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis (.env en local, secrets en CI)."
  );
}

// La service_role key contourne les policies RLS : à n'utiliser QUE côté serveur
// (scraper, API routes), jamais côté navigateur.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
