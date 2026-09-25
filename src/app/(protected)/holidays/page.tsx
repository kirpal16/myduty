import { NavLink as Link } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isSuperAdmin } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { createGlobalOrProfileHoliday } from "@/actions/holiday";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { HolidayRowActions } from "@/components/holiday/holiday-row-actions";
import { GujaratHolidayImporter } from "@/components/holiday/gujarat-holiday-importer";
import {
  Sun,
  Palmtree,
  Plus,
  Calendar,
  Sparkles,
} from "lucide-react";

import type { HolidayScope } from "@/types/database";
import { getYearOptions, clampYear } from "@/lib/format/year";
import { ActionForm } from "@/components/ui/action-form";

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    scope?: string;
    year?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { tab = "all", search, scope, year, page = "1", limit = "10" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 10);

  const selectedYear = clampYear(year);
  const yearOptions = getYearOptions(3, 2);

  const supabase = await createClient();
  const [{ data: profiles }, canCreate, canDelete] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("is_active", true),
    hasPermission(PERMISSIONS.HOLIDAY_CREATE).then(
      async (p) => p || (await isSuperAdmin()),
    ),
    hasPermission(PERMISSIONS.HOLIDAY_DELETE).then(
      async (p) => p || (await isSuperAdmin()),
    ),
  ]);

  let query = supabase
    .from("holidays")
    .select("id, name, holiday_date, scope, is_government, is_optional, is_recurring_yearly, profile_id, profiles(name)", {
      count: "exact",
    })
    .in("scope", ["GLOBAL", "PROFILE"])
    .order("holiday_date");

  if (tab === "gazetted") {
    query = query.eq("is_optional", false);
  } else if (tab === "optional") {
    query = query.eq("is_optional", true);
  }

  if (scope) {
    query = query.eq("scope", scope as HolidayScope);
  }

  // Filter by selectedYear (defaults to current year, e.g. 2026) so admin and user counts match
  query = query
    .gte("holiday_date", `${selectedYear}-01-01`)
    .lte("holiday_date", `${selectedYear}-12-31`);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: holidays, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const baseParams = (newTab?: string) => {
    const p = new URLSearchParams();
    if (newTab && newTab !== "all") p.set("tab", newTab);
    if (search) p.set("search", search);
    if (scope) p.set("scope", scope);
    p.set("year", String(selectedYear));
    return p.toString();
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      {/* Amber/Gold Page Header */}
      <PageHeader
        title="Official & Departmental Holidays"
        subtitle="Manage public holidays and profile-specific non-working days."
        badge={
          <Badge variant="warning" dot>
            {totalItems} Holidays ({selectedYear})
          </Badge>
        }
        actions={
          <Link
            href="/holidays/mine"
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shadow-2xs transition-colors"
          >
            <Palmtree className="size-4" />
            <span>My Personal Holidays</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Table list - 2 columns */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <GujaratHolidayImporter currentYear={selectedYear} scope="GLOBAL" />

          {/* Category Tabs: Gazetted vs Optional vs All */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/80 w-full sm:w-fit max-w-full overflow-x-auto custom-scrollbar">
            <Link
              href={`/holidays?${baseParams("all")}`}
              scroll={false}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === "all"
                  ? "bg-card text-foreground shadow-xs border border-border font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">All Holidays</span>
              <span className="sm:hidden">All</span>
            </Link>
            <Link
              href={`/holidays?${baseParams("gazetted")}`}
              scroll={false}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === "gazetted"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">Gazetted Holidays (જાહેર)</span>
              <span className="sm:hidden">Gazetted (જાહેર)</span>
            </Link>
            <Link
              href={`/holidays?${baseParams("optional")}`}
              scroll={false}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === "optional"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">Optional Holidays (મરજિયાત)</span>
              <span className="sm:hidden">Optional (મરજિયાત)</span>
            </Link>
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="w-full sm:max-w-xs">
                <SearchInput
                  placeholder="Search holidays..."
                  defaultValue={search}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-28">
                  <FilterSelect
                    paramName="year"
                    placeholder={String(selectedYear)}
                    icon="calendar"
                    options={yearOptions}
                    value={String(selectedYear)}
                    clearable={false}
                  />
                </div>

                <Link
                  href={
                    scope === "GLOBAL"
                      ? `/holidays?${new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), year: String(selectedYear), ...(search ? { search } : {}) }).toString()}`
                      : `/holidays?${new URLSearchParams({ scope: "GLOBAL", ...(tab !== "all" ? { tab } : {}), year: String(selectedYear), ...(search ? { search } : {}) }).toString()}`
                  }
                  scroll={false}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    scope === "GLOBAL"
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>Global</span>
                </Link>
                <Link
                  href={
                    scope === "PROFILE"
                      ? `/holidays?${new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), year: String(selectedYear), ...(search ? { search } : {}) }).toString()}`
                      : `/holidays?${new URLSearchParams({ scope: "PROFILE", ...(tab !== "all" ? { tab } : {}), year: String(selectedYear), ...(search ? { search } : {}) }).toString()}`
                  }
                  scroll={false}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    scope === "PROFILE"
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>Profile</span>
                </Link>

                {(search || scope || tab !== "all" || year) && (
                  <Link
                    href={`/holidays?year=${selectedYear}`}
                    scroll={false}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <span>Reset</span>
                  </Link>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Holiday Name</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Scope</th>
                    <th className="py-3.5 px-4">Category</th>
                    {(canCreate || canDelete) && (
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(holidays ?? []).map((h) => {
                    const profileName = (
                      h.profiles as unknown as { name: string } | null
                    )?.name;

                    return (
                      <tr
                        key={h.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                          {h.name}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                          {h.holiday_date}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {h.scope === "GLOBAL" ? (
                            <Badge variant="info">Global</Badge>
                          ) : (
                            <Badge variant="warning">
                              {profileName ? `Profile: ${profileName}` : "Profile"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {h.is_optional ? (
                            <Badge variant="purple" dot>
                              Optional (મરજિયાત)
                            </Badge>
                          ) : h.is_government ? (
                            <Badge variant="danger" dot>
                              Gazetted (જાહેર)
                            </Badge>
                          ) : (
                            <Badge variant="outline">Regular</Badge>
                          )}
                        </td>
                        {(canCreate || canDelete) && (
                          <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                            <HolidayRowActions
                              holiday={h}
                              profiles={profiles ?? []}
                              canEdit={canCreate}
                              canDelete={canDelete}
                              redirectPath="/holidays"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-border/60">
              {(holidays ?? []).map((h) => {
                const profileName = (
                  h.profiles as unknown as { name: string } | null
                )?.name;

                return (
                  <div key={h.id} className="p-4 space-y-2.5 bg-card hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {h.name}
                      </span>
                      {h.is_optional ? (
                        <Badge variant="purple" dot>Optional</Badge>
                      ) : h.is_government ? (
                        <Badge variant="danger" dot>Govt</Badge>
                      ) : (
                        <Badge variant="outline">Regular</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Calendar className="size-3.5 text-amber-500" />
                        {h.holiday_date}
                      </span>
                      <Badge variant={h.scope === "GLOBAL" ? "info" : "warning"}>
                        {h.scope === "GLOBAL" ? "Global" : (profileName ? `Profile: ${profileName}` : "Profile")}
                      </Badge>
                    </div>

                    {(canCreate || canDelete) && (
                      <div className="pt-2 border-t border-border/40 flex justify-end">
                        <HolidayRowActions
                          holiday={h}
                          profiles={profiles ?? []}
                          canEdit={canCreate}
                          canDelete={canDelete}
                          redirectPath="/holidays"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(holidays ?? []).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Sun className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium text-foreground">
                    No holidays found
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

        {/* Add Holiday Form - 1 column */}
        {canCreate && (
          <div>
            <Card className="p-6 lg:sticky lg:top-20">
              <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                <Plus className="size-4.5 text-amber-500" />
                <span>Add Official Holiday</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Define a public gazetted or optional non-working day.
              </p>

              <ActionForm
                action={createGlobalOrProfileHoliday}
                submitLabel="Add Holiday"
                successMessage="Holiday added."
                fields={[
                  {
                    name: "name",
                    label: "Holiday Name",
                    required: true,
                    placeholder: "e.g. Republic Day or Jamshedi Navroz",
                  },
                  {
                    name: "holidayDate",
                    label: "Date",
                    type: "date",
                    required: true,
                  },
                  {
                    name: "scope",
                    label: "Applies To",
                    type: "select",
                    required: true,
                    defaultValue: "GLOBAL",
                    options: [
                      { value: "GLOBAL", label: "Everyone" },
                      { value: "PROFILE", label: "One profile" },
                    ],
                  },
                  {
                    name: "profileId",
                    label: "Profile",
                    type: "select",
                    placeholder: "Select a profile",
                    options: (profiles ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                    hint: "Only used when this applies to one profile.",
                  },
                  { name: "isGovernment", label: "Government declared holiday", type: "checkbox" },
                  { name: "isOptional", label: "Optional holiday (મરજિયાત રજા - max 2/yr choice)", type: "checkbox" },
                  { name: "isRecurringYearly", label: "Repeats every year", type: "checkbox" },
                ]}
              />
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
