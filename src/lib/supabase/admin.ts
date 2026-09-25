import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client — BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Only ever call this from trusted server contexts (Route Handlers, the
 * bootstrap script) and only AFTER independently verifying the caller's
 * permission/ownership with the user-scoped client from ./server.ts.
 * Never import this from a "use client" file — the `server-only` import
 * above makes that a build-time error, not just a convention.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
