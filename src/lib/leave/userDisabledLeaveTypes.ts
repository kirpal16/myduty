import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns a Set of leave_type_id strings that the current officer has disabled.
 * Disabled types are excluded from the leave logging dropdowns and officer's active lists.
 */
export const getUserDisabledLeaveTypeIds = cache(
  async (userId?: string): Promise<Set<string>> => {
    try {
      const supabase = await createClient();
      let targetUserId = userId;
      if (!targetUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }
      if (!targetUserId) return new Set<string>();

      const { data, error } = await supabase
        .from("user_disabled_leave_types")
        .select("leave_type_id")
        .eq("user_id", targetUserId);

      if (error || !data) {
        return new Set<string>();
      }

      return new Set(data.map((r) => r.leave_type_id));
    } catch {
      return new Set<string>();
    }
  },
);
