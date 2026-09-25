import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { UploadModal } from "@/components/storage/upload-modal";
import { StorageFileTable } from "@/components/storage/storage-file-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { NavLink as Link } from "@/components/ui/nav-link";
import { getYearOptions } from "@/lib/format/year";

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    year?: string;
    from?: string;
    to?: string;
    type?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const canAccess =
    user?.role === "SUPER_ADMIN" ||
    (await hasPermission(PERMISSIONS.STORAGE_VIEW_ALL));
  if (!canAccess) {
    redirect("/dashboard");
  }
  const {
    search,
    year,
    from: fromDate,
    to: toDate,
    type,
    page = "1",
    limit = "10",
  } = await searchParams;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 10);

  const yearOptions = getYearOptions(4, 1);

  const typeOptions = [
    { value: "image", label: "Images (JPG, PNG)" },
    { value: "pdf", label: "PDF Documents" },
    { value: "doc", label: "Word Documents" },
  ];

  const supabase = await createClient();

  let query = supabase
    .from("file_attachments")
    .select("id, original_filename, mime_type, size_bytes, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("original_filename", `%${search}%`);
  }

  if (year) {
    query = query
      .gte("created_at", `${year}-01-01T00:00:00.000Z`)
      .lte("created_at", `${year}-12-31T23:59:59.999Z`);
  }

  if (fromDate) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`);
  }

  if (type === "image") {
    query = query.ilike("mime_type", "image/%");
  } else if (type === "pdf") {
    query = query.ilike("mime_type", "%pdf%");
  } else if (type === "doc") {
    query = query.or("mime_type.ilike.%word%,mime_type.ilike.%document%");
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: files, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      {/* Sky Blue Header */}
      <PageHeader
        title="Document & File Vault"
        // So the file count fits beside it on a phone rather than dropping
        // to a line of its own.
        shortTitle="File Vault"
        subtitle="Securely upload, store, and manage duty attachments, receipts, and official records."
        badge={
          <Badge variant="info" dot>
            {totalItems} Files
          </Badge>
        }
        compactActions
        actions={<UploadModal />}
      />

      {/* The uploader used to be a sticky card holding a third of this grid,
          which on a phone meant the vault opened on a dropzone with the files
          pushed below the fold. It is a dialog now, so the list gets the full
          width and is the first thing on screen. */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:max-w-xs">
              <SearchInput
                placeholder="Search file name..."
                defaultValue={search}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-32">
                <FilterSelect
                  paramName="type"
                  placeholder="All Types"
                  icon="tag"
                  options={typeOptions}
                />
              </div>

              <div className="w-28">
                <FilterSelect
                  paramName="year"
                  placeholder="All years"
                  icon="calendar"
                  options={yearOptions}
                />
              </div>

              <div className="w-44">
                <DateRangeFilter
                  fromParamName="from"
                  toParamName="to"
                  label="Date Range"
                />
              </div>

              {(search || year || fromDate || toDate || type) && (
                <Link
                  href="/storage"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Reset all filters"
                >
                  Reset
                </Link>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <StorageFileTable files={files ?? []} />

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        </Card>
      </div>
    </main>
  );
}
