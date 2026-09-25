import { createClient } from "@/lib/supabase/server";
import { createDutyType } from "@/actions/duty";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Layers, Plus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { translateDutyTypeToGujarati } from "@/lib/reports/gujaratiReportUtils";
import { DutyTypeActions } from "@/components/admin/duty-type-actions";

export default async function DutyTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const { search, page = "1", limit = "25" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 25);

  const supabase = await createClient();

  const [{ data: profiles }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("is_active", true),
  ]);

  let query = supabase
    .from("duty_types")
    .select("id, name, code, is_active, profile_id, profiles(name)", {
      count: "exact",
    })
    .order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: dutyTypes, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Duty Classifications"
        subtitle="Manage duty types, role profile scopes, and standard operational shifts."
        badge={<Badge variant="purple">{totalItems} Duty Types</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="w-full max-w-sm">
              <SearchInput
                placeholder="Search duty type name or code..."
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
                    <th className="py-3.5 px-4 sm:px-6">Classification</th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Officer Profile</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(dutyTypes ?? []).map((dt) => {
                    const profileName = (
                      dt.profiles as unknown as { name: string } | null
                    )?.name;

                    return (
                      <tr
                        key={dt.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                          <div className="flex flex-col">
                            <span>{dt.name}</span>
                            {translateDutyTypeToGujarati(dt.name) !== dt.name && (
                              <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
                                {translateDutyTypeToGujarati(dt.name)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          {dt.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="secondary">
                            {profileName ?? "General"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          {dt.is_active ? (
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
                          <DutyTypeActions
                            dutyType={{
                              id: dt.id,
                              name: dt.name,
                              code: dt.code,
                              is_active: dt.is_active,
                              profile_id: dt.profile_id,
                            }}
                            profiles={profiles ?? []}
                            layout="row"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col divide-y divide-border/60">
              {(dutyTypes ?? []).map((dt) => {
                const profileName = (
                  dt.profiles as unknown as { name: string } | null
                )?.name;

                return (
                  <div
                    key={dt.id}
                    className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-card hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-foreground">
                          {dt.name}
                        </span>
                        {translateDutyTypeToGujarati(dt.name) !== dt.name && (
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded">
                            {translateDutyTypeToGujarati(dt.name)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground font-semibold">
                          {dt.code}
                        </span>
                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                        {dt.is_active ? (
                          <Badge variant="success" dot className="px-1.5 py-0.2 text-[9.5px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" dot className="px-1.5 py-0.2 text-[9.5px]">
                            Inactive
                          </Badge>
                        )}
                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {profileName ?? "General"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 pt-1">
                      <DutyTypeActions
                        dutyType={{
                          id: dt.id,
                          name: dt.name,
                          code: dt.code,
                          is_active: dt.is_active,
                          profile_id: dt.profile_id,
                        }}
                        profiles={profiles ?? []}
                        layout="compact"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {(dutyTypes ?? []).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Layers className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium text-foreground">
                    No duty types found
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

        {/* Add Duty Type Form Card */}
        <div>
          <Card className="p-4 sm:p-6 lg:sticky lg:top-20">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Plus className="size-4.5 text-indigo-500" />
              <span>Add Duty Type</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Create a new shift classification for officers.
            </p>

            <ActionForm
              action={createDutyType}
              submitLabel="Save Duty Type"
              successMessage="Duty type created."
              fields={[
                {
                  name: "profileId",
                  label: "Associated Profile",
                  type: "select",
                  required: true,
                  placeholder: "Select role profile",
                  options: (profiles ?? []).map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                },
                {
                  name: "name",
                  label: "Duty Type Name",
                  required: true,
                  placeholder: "e.g. Night Patrol",
                },
                {
                  name: "code",
                  label: "Duty Code",
                  required: true,
                  placeholder: "e.g. NIGHT_PATROL",
                  uppercase: true,
                  hint: "Stored upper-case with spaces as underscores.",
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
