import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — initialized on first request, never at module load.
// This keeps CI builds and Workers module evaluation safe even without env vars.
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  return _client;
}
