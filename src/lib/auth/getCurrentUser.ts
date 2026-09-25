import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TimeFormat } from "@/types/database";

export type CurrentUser = {
  id: string;
  email: string | undefined;
  profileId: string | null;
  departmentId: string | null;
  role: "SUPER_ADMIN" | "USER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  fullName: string;
  timeFormat: TimeFormat;
  avatarUrl: string | null;
};

/**
 * The DAL entry point for every Server Component/Action/Route Handler that
 * needs to know who's calling. Cached per-request (React cache()) so it's
 * cheap to call from multiple places in one render pass.
 *
 * Returns null for an unauthenticated visitor OR an authenticated auth.users
 * row with no matching public.users row yet (shouldn't happen once the
 * signup trigger is in place, but the caller shouldn't assume it never can).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: row } = await supabase
    .from("users")
    .select(
      "id, profile_id, department_id, role, status, full_name, time_format, avatar_url",
    )
    .eq("id", authUser.id)
    .single();

  if (!row) return null;

  return {
    id: row.id,
    email: authUser.email,
    profileId: row.profile_id,
    departmentId: row.department_id,
    role: row.role,
    status: row.status,
    fullName: row.full_name,
    timeFormat: row.time_format,
    avatarUrl: (row as { avatar_url?: string | null }).avatar_url ?? null,
  };
});
