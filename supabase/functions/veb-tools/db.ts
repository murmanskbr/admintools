import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const DB_SECRET_KEY =
    Deno.env.get("DB_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY");

export function getSupabase() {
    if (!SUPABASE_URL || !DB_SECRET_KEY) {
        throw new Error("SERVER_CONFIGURATION_ERROR");
    }

    return createClient(SUPABASE_URL, DB_SECRET_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
