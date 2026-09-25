import { createClient } from "@/lib/supabase/server";
import {
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  toggleLeaveTypeActive,
} from "@/actions/leave";
import { LeaveTypeManager } from "@/components/leave/leave-type-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { SearchInput } from "@/components/ui/search-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { FileText, Plus, CheckCircle2, XCircle } from "lucide-react";
import { PendingButton } from "@/components/ui/pending-button";
import { ActionButton } from "@/components/ui/action-button";

export default async function LeaveTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const { search, page = "1", limit = "10" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 10);

  const supabase = await createClient();

  let query = supabase
    .from("leave_types")
    // is_system so the manager can hide edit/delete on HL / OH / SPL, which
    // RLS refuses anyway — silently, which read as "delete does nothing".
    .select("id, name, code, color, is_active, user_id, is_system", { count: "exact" })
    // Personal types belong to the officer who made them; admin manages the
    // department-wide set only.
    .is("user_id", null)
    .order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: leaveTypes, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Leave Classification Categories"
        subtitle="Manage statutory, medical, and personal leave entitlement categories."
        badge={<Badge variant="purple">{totalItems} Leave Types</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="w-full max-w-sm">
              <SearchInput
                placeholder="Search leave category..."
                defaultValue={search}
              />
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Category Name</th>
                    <th className="py-3.5 px-4">Category Code</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(leaveTypes ?? []).map((lt) => (
                    <tr
                      key={lt.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                        <span className="flex items-center gap-2">
                          <ColorDot
                            color={lt.color}
                            label={lt.name}
                            size="md"
                          />
                          {lt.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {lt.code}
                      </td>
                      <td className="py-3.5 px-4">
                        {lt.is_active ? (
                          <Badge variant="success" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" dot>
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <form
                          action={toggleLeaveTypeActive.bind(
                            null,
                            lt.id,
                            lt.is_active,
                          )}
                        >
                          <PendingButton
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
                              lt.is_active
                                ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                : "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                            }`}
                          >
                            {lt.is_active ? (
                              <>
                                <XCircle className="size-3" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-3" />
                                <span>Activate</span>
                              </>
                            )}
                          </PendingButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col divide-y divide-border/60">
              {(leaveTypes ?? []).map((lt) => (
                <div
                  key={lt.id}
                  className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <ColorDot color={lt.color} label={lt.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-foreground block truncate">
                        {lt.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground font-semibold">
                          {lt.code}
                        </span>
                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                        {lt.is_active ? (
                          <Badge variant="success" dot className="px-1.5 py-0.2 text-[9.5px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" dot className="px-1.5 py-0.2 text-[9.5px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <ActionButton
                      action={toggleLeaveTypeActive.bind(
                        null,
                        lt.id,
                        lt.is_active,
                      )}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                        lt.is_active
                          ? "border-amber-300/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                          : "border-emerald-300/70 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      }`}
                      successMessage={"Leave type updated."}
                    >
                      {lt.is_active ? (
                        <>
                          <XCircle className="size-3.5" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>Activate</span>
                        </>
                      )}
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>

            {(leaveTypes ?? []).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium text-foreground">
                    No leave types found
                  </p>
                </div>
              </div>
            )}

            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
            />
          </Card>
        </div>

        {/* Create / edit / delete. Previously this was create-only, so a typo
            in a category name could never be corrected and an unused category
            could never be removed. */}
        <div>
          <Card className="p-4 sm:p-6 lg:sticky lg:top-20">
            <h3 className="mb-1 flex items-center gap-2 text-sm sm:text-base font-bold text-foreground">
              <Plus className="size-4 sm:size-4.5 text-indigo-500" />
              <span>Manage Leave Categories</span>
            </h3>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Department-wide categories, available to every officer. Officers
              can add types of their own in their settings.
            </p>

            <LeaveTypeManager
              types={leaveTypes ?? []}
              editable
              onCreate={createLeaveType}
              onUpdate={updateLeaveType}
              onDelete={deleteLeaveType}
              title="Department leave types"
              emptyHint="No leave categories defined yet."
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
