"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { DeleteHolidayButton } from "./delete-holiday-button";
import { EditHolidayModal } from "./edit-holiday-modal";
import type { HolidayScope } from "@/types/database";

export interface HolidayRowActionsProps {
  holiday: {
    id: string;
    name: string;
    holiday_date: string;
    scope: HolidayScope;
    profile_id?: string | null;
    is_government?: boolean | null;
    is_optional?: boolean | null;
    is_recurring_yearly?: boolean | null;
  };
  profiles?: { id: string; name: string }[];
  canEdit?: boolean;
  canDelete?: boolean;
  redirectPath?: string;
  iconOnly?: boolean;
}

export function HolidayRowActions({
  holiday,
  profiles = [],
  canEdit = true,
  canDelete = true,
  redirectPath = "/holidays",
  iconOnly = false,
}: HolidayRowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 justify-end">
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer ${
              iconOnly
                ? "p-1.5"
                : "px-2.5 py-1 text-xs font-semibold"
            }`}
            title="Edit Holiday"
          >
            <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" />
            {!iconOnly && <span>Edit</span>}
          </button>

          <EditHolidayModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            holiday={holiday}
            profiles={profiles}
          />
        </>
      )}

      {canDelete && (
        <DeleteHolidayButton
          id={holiday.id}
          redirectPath={redirectPath}
          iconOnly={iconOnly}
          size="sm"
        />
      )}
    </div>
  );
}
