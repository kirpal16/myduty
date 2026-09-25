import { createClient } from "@/lib/supabase/server";
import { createProfile, toggleProfileActive } from "@/actions/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { UserCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { PendingButton } from "@/components/ui/pending-button";
import { ActionForm } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/action-button";

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const { search, page = "1", limit = "10" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 10);

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, name, code, description, is_active", { count: "exact" })
    .order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: profiles, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Officer Profile Classifications"
        subtitle="Manage designation profiles (e.g. Executive, Operational, Medical) and role templates."
        badge={<Badge variant="purple">{totalItems} Profiles</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="w-full max-w-sm">
              <SearchInput
                placeholder="Search profile name or code..."
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
                    <th className="py-3.5 px-4 sm:px-6">Profile Name</th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(profiles ?? []).map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {p.code}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {p.description ?? "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.is_active ? (
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
                          action={toggleProfileActive.bind(
                            null,
                            p.id,
                            p.is_active,
                          )}
                        >
                          <PendingButton
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
                              p.is_active
                                ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                : "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                            }`}
                          >
                            {p.is_active ? (
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
              {(profiles ?? []).map((p) => (
                <div
                  key={p.id}
                  className="p-4 space-y-2.5 bg-card hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-foreground">
                        {p.name}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                        {p.code}
                      </span>
                    </div>
                    {p.is_active ? (
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="danger" dot>
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-border/40 flex justify-end">
                    <ActionButton
                      action={toggleProfileActive.bind(null, p.id, p.is_active)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs ${
                        p.is_active
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                      successMessage={"Profile updated."}
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>

            {(profiles ?? []).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <UserCheck className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium text-foreground">
                    No profiles found
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

        {/* Add Profile Form Card */}
        <div>
          <Card className="p-6 lg:sticky lg:top-20">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Plus className="size-4.5 text-indigo-500" />
              <span>Add Role Profile</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Register a designation profile for officer onboarding.
            </p>

            <ActionForm
              action={createProfile}
              submitLabel="Save Profile"
              successMessage="Profile created."
              fields={[
                {
                  name: "name",
                  label: "Profile Name",
                  required: true,
                  placeholder: "e.g. Field Operative",
                },
                {
                  name: "code",
                  label: "Profile Code",
                  required: true,
                  placeholder: "e.g. FIELD_OP",
                  uppercase: true,
                  hint: "Stored upper-case with spaces as underscores.",
                },
                {
                  name: "description",
                  label: "Description",
                  placeholder: "Brief role responsibilities...",
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
