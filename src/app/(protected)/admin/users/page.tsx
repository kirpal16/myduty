import { NavLink as Link } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveUser, rejectUser } from "@/actions/users";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  Users,
  CheckCircle,
  XCircle,
  Settings2,
  User,
  Mail,
} from "lucide-react";

import type { UserStatus, UserRole } from "@/types/database";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteUserModal } from "@/components/admin/delete-user-modal";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    role?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { search, status, role, page = "1", limit = "15" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 15);

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("users")
    .select("id, full_name, role, status, employee_code, phone, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status as UserStatus);
  }

  if (role) {
    query = query.eq("role", role as UserRole);
  }

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,employee_code.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: users, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Fetch auth emails for the visible users via admin client
  const adminClient = createAdminClient();
  const emailMap = new Map<string, string>();
  if (users && users.length > 0) {
    const { data: authData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authData?.users) {
      for (const au of authData.users) {
        if (au.email) emailMap.set(au.id, au.email);
      }
    }
  }

  const getStatusBadge = (userStatus: string) => {
    switch (userStatus) {
      case "APPROVED":
        return (
          <Badge variant="success" dot>
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="danger" dot>
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" dot>
            Pending Review
          </Badge>
        );
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Officer Directory & Access Control"
        subtitle="Authorize officer accounts, configure roles, and grant granular permissions."
        badge={
          <Badge variant="purple" dot>
            {totalItems} Total Officers
          </Badge>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="w-full md:max-w-md">
            <SearchInput
              placeholder="Search by name, employee code, phone..."
              defaultValue={search}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["APPROVED", "PENDING", "REJECTED"].map((s) => {
              const active = status === s;
              return (
                <Link
                  key={s}
                  href={
                    active
                      ? `/admin/users${search ? `?search=${search}` : ""}`
                      : `/admin/users?status=${s}${search ? `&search=${search}` : ""}`
                  }
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs ${
                    active
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s}
                </Link>
              );
            })}

            {(search || status || role) && (
              <Link
                href="/admin/users"
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Container with Desktop Table AND Mobile Card View */}
      <Card className="p-0 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Officer Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Employee Code</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Registered</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(users ?? []).map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground whitespace-nowrap">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2"
                    >
                      <User className="size-3.5 text-slate-400" />
                      <span>{u.full_name}</span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground text-xs max-w-[200px] truncate" title={emailMap.get(u.id) ?? ""}>
                    {emailMap.get(u.id) ? (
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3 shrink-0 text-slate-400" />
                        <span className="truncate">{emailMap.get(u.id)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-mono">
                    {u.employee_code ?? "—"}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge
                      variant={u.role === "SUPER_ADMIN" ? "purple" : "outline"}
                    >
                      {u.role.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getStatusBadge(u.status)}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {u.status !== "APPROVED" && (
                        <ActionButton
                          action={approveUser.bind(null, u.id)}
                          className={
                            "inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                          }
                          successMessage={"Officer approved."}
                        >
                          <CheckCircle className="size-3" />
                          <span>Approve</span>
                        </ActionButton>
                      )}
                      {u.status !== "REJECTED" && (
                        <ActionButton
                          action={rejectUser.bind(null, u.id)}
                          className={
                            "inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                          }
                          successMessage={"Officer rejected."}
                        >
                          <XCircle className="size-3" />
                          <span>Reject</span>
                        </ActionButton>
                      )}
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                      >
                        <Settings2 className="size-3" />
                        <span>Config</span>
                      </Link>
                      {currentUser?.id !== u.id && (
                        <DeleteUserModal
                          userId={u.id}
                          userName={u.full_name}
                          userRole={u.role}
                          variant="table-action"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col divide-y divide-border/60">
          {(users ?? []).map((u) => (
            <div
              key={u.id}
              className="p-4 space-y-3 bg-card hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-sm font-bold text-foreground hover:text-indigo-600 flex items-center gap-1.5"
                  >
                    <User className="size-3.5 text-indigo-500" />
                    <span>{u.full_name}</span>
                  </Link>
                  {u.employee_code && (
                    <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                      Code: {u.employee_code}
                    </span>
                  )}
                  {emailMap.get(u.id) && (
                    <span className="text-xs text-muted-foreground block mt-0.5 flex items-center gap-1">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{emailMap.get(u.id)}</span>
                    </span>
                  )}
                </div>
                {getStatusBadge(u.status)}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60">
                <span className="font-medium text-foreground">
                  Role: {u.role.replace("_", " ")}
                </span>
                <span>
                  Registered: {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                {u.status !== "APPROVED" && (
                  <ActionButton
                    action={approveUser.bind(null, u.id)}
                    className={
                      "w-full inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 py-2 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                    }
                    successMessage={"Officer approved."}
                  >
                    <CheckCircle className="size-3.5" />
                    <span>Approve</span>
                  </ActionButton>
                )}
                {u.status !== "REJECTED" && (
                  <ActionButton
                    action={rejectUser.bind(null, u.id)}
                    className={
                      "w-full inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                    }
                    successMessage={"Officer rejected."}
                  >
                    <XCircle className="size-3.5" />
                    <span>Reject</span>
                  </ActionButton>
                )}
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                >
                  <Settings2 className="size-3.5" />
                  <span>Config</span>
                </Link>
                {currentUser?.id !== u.id && (
                  <DeleteUserModal
                    userId={u.id}
                    userName={u.full_name}
                    userRole={u.role}
                    variant="mobile-card"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {(users ?? []).length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-2">
              <Users className="size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium text-foreground">
                No officers found
              </p>
              <p className="text-xs text-muted-foreground">
                Try modifying your search or filter options.
              </p>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
        />
      </Card>
    </main>
  );
}
