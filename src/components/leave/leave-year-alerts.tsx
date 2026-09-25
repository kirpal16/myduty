import { NavLink as Link } from "@/components/ui/nav-link";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { ColorDot } from "@/components/ui/color-dot";
import { AllowancePromptForm } from "./allowance-prompt-form";
import { daysAtRisk } from "@/lib/leave/carryForward";

/**
 * The two things an officer needs telling about their leave year.
 *
 * Both are quiet by default: they render nothing at all unless there is
 * something to say. A banner that is always present is not read on the one
 * occasion it matters.
 */

export type LeaveYearRow = {
  leave_type_id: string;
  allocated: number;
  allocation_exists: boolean;
  carried_in: number;
  carry_forward: boolean;
  max_accumulated: number | null;
  remaining: number;
};

export type LeaveTypeInfo = {
  id: string;
  name: string;
  color: string | null;
  isSystem: boolean;
};

/** October onwards — see the comment on the component below. */
const WARNING_FROM_MONTH = 9; // 0-indexed: 9 = October

export function LeaveYearAlerts({
  rows,
  types,
  year,
  nextYearRows = [],
  now = new Date(),
}: {
  rows: LeaveYearRow[];
  types: LeaveTypeInfo[];
  year: number;
  /** Next year's rows, if any exist yet, so the estimate can be exact. */
  nextYearRows?: { leave_type_id: string; allocated: number; allocation_exists: boolean }[];
  now?: Date;
}) {
  const typeById = new Map(types.map((t) => [t.id, t]));
  const nextByType = new Map(nextYearRows.map((r) => [r.leave_type_id, r]));

  // ---------------------------------------------------------------------
  // A. Days that will not survive 31 December.
  //
  // Shown from October only. Running this from January would make it
  // wallpaper by March, and the point is to prompt action while there is
  // still time to book the leave.
  // ---------------------------------------------------------------------
  const expiring =
    now.getMonth() >= WARNING_FROM_MONTH
      ? rows
          .map((row) => {
            const type = typeById.get(row.leave_type_id);
            // Holiday Leave is never "lost" in this sense — working a holiday
            // earns extra pay instead. Warning about it would be wrong.
            if (!type || type.isSystem) return null;

            const next = nextByType.get(row.leave_type_id);
            const days = daysAtRisk({
              remaining: Number(row.remaining ?? 0),
              allocated: Number(row.allocated ?? 0),
              rule: {
                carryForward: row.carry_forward,
                maxAccumulated: row.max_accumulated,
              },
              // Only a saved row counts as known; a placeholder zero would
              // make the estimate confidently wrong.
              nextYearAllocation: next?.allocation_exists ? next.allocated : null,
            });

            if (days <= 0) return null;
            return { type, days, row, estimated: !next?.allocation_exists };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  // ---------------------------------------------------------------------
  // B. This year's grant has not been entered.
  //
  // Carry-forward happens on its own, but the new year's allocation is a
  // number only the officer knows. Until they enter it the balance is just
  // the carried days and reads as wrong.
  //
  // Keyed off allocation_exists, never off `allocated === 0`: an officer who
  // genuinely has no entitlement sets 0 once and must not be asked again.
  // ---------------------------------------------------------------------
  const unset = rows
    .map((row) => {
      const type = typeById.get(row.leave_type_id);
      if (!type || type.isSystem) return null;
      if (row.allocation_exists) return null;
      if (Number(row.carried_in ?? 0) <= 0) return null;
      return { type, row };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (expiring.length === 0 && unset.length === 0) return null;

  return (
    <div className="space-y-3">
      {unset.map(({ type, row }) => (
        <div
          key={`unset-${type.id}`}
          className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <CalendarPlus className="mt-0.5 size-4 shrink-0 text-indigo-500" />
            <p className="text-xs text-foreground">
              <span className="font-bold">
                {row.carried_in}d of <ColorDot color={type.color} label={type.name} />{" "}
                {type.name}
              </span>{" "}
              carried over from {year - 1}. How many days were you granted for{" "}
              {year}?
            </p>
          </div>

          <AllowancePromptForm
            leaveTypeId={type.id}
            typeName={type.name}
            year={year}
            carryForward={row.carry_forward}
            maxAccumulated={row.max_accumulated}
          />
        </div>
      ))}

      {expiring.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold text-foreground">
                Leave that will not carry past 31 December
              </p>
              <ul className="space-y-0.5">
                {expiring.map(({ type, days, row, estimated }) => (
                  <li key={type.id} className="text-[11px] text-muted-foreground">
                    <ColorDot color={type.color} label={type.name} />{" "}
                    <span className="font-semibold text-foreground">{type.name}</span>:{" "}
                    {row.remaining}d remaining,{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {days}d will be lost
                    </span>
                    {/* Say when the figure rests on an assumption. A guess
                        presented as a fact is worse than saying nothing. */}
                    {row.carry_forward && estimated
                      ? ` if you are granted the same ${row.allocated}d next year`
                      : ""}
                    .
                  </li>
                ))}
              </ul>
              <Link
                href="/leave/new"
                className="inline-block pt-0.5 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Log leave
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
