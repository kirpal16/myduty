import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { StoragePermissionToggle } from "@/components/admin/storage-permission-toggle";
import {
  HardDrive,
  User,
  ShieldCheck,
  FolderLock,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default async function AdminPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const supabase = await createClient();

  let usersQuery = supabase
    .from("users")
    .select("id, full_name, employee_code, departments(name)")
    .eq("status", "APPROVED")
    .eq("role", "USER")
    .order("full_name");

  if (search) {
    usersQuery = usersQuery.ilike("full_name", `%${search}%`);
  }

  const [{ data: users }, { data: storagePermission }, { data: storageGrants }] =
    await Promise.all([
      usersQuery,
      supabase.from("permissions").select("id").eq("code", "STORAGE_VIEW_ALL").maybeSingle(),
      supabase
        .from("user_permissions")
        .select("user_id, permission_id, permissions!inner(code)")
        .eq("permissions.code", "STORAGE_VIEW_ALL"),
    ]);

  const grantedUsers = new Set((storageGrants ?? []).map((g) => g.user_id));
  const totalOfficers = (users ?? []).length;
  const enabledCount = (users ?? []).filter((u) => grantedUsers.has(u.id)).length;
  const disabledCount = totalOfficers - enabledCount;

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Storage & File Attachment Access Control"
        subtitle="Manage which officers are authorized to view the Document Vault (/storage) and upload attachments on Duty and Leave logs."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="purple">Storage Authorization</Badge>
            <Badge variant="success">
              {enabledCount} Allowed
            </Badge>
          </div>
        }
      />

      {/* Overview Stats & Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <UploadCloud className="size-4 shrink-0" />
            <span>Storage Access Granted ({enabledCount})</span>
          </div>
          <p className="text-xs text-foreground font-semibold">
            Full Files & Upload Privileges
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Officers with this permission can access <strong>Files (/storage)</strong> and upload document/photo attachments when submitting Duty logs and Leave requests.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            <Lock className="size-4 shrink-0" />
            <span>Storage Access Disabled ({disabledCount})</span>
          </div>
          <p className="text-xs text-foreground font-semibold">
            Files & Uploader Completely Hidden
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The &quot;Files&quot; menu is removed from their sidebar, and the file upload box is hidden on all Duty and Leave forms.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Super Admin Override</span>
          </div>
          <p className="text-xs text-foreground font-semibold">
            Super Admins Retain Permanent Access
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Super Admins automatically have full storage and system access at all times.
          </p>
        </div>
      </div>

      {/* Search Header */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full max-w-sm">
            <SearchInput
              placeholder="Search officer by name..."
              defaultValue={search}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Toggle switch ON to allow storage and file uploads for that officer.
          </span>
        </div>
      </Card>

      {/* Officers List with Toggle */}
      <Card className="p-0 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Officer Name</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Duty & Leave Uploads</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Storage Access Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(users ?? []).map((u) => {
                const isGranted = grantedUsers.has(u.id);
                const dept = u.departments as unknown as { name: string } | null;

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                          {u.full_name?.charAt(0) || "O"}
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">{u.full_name}</span>
                          {u.employee_code && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              Code: {u.employee_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      {dept?.name || "General"}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isGranted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          <span>File Uploader Enabled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Lock className="size-3.5 text-slate-400" />
                          <span>Uploader Hidden</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex justify-end">
                        <StoragePermissionToggle
                          userId={u.id}
                          officerName={u.full_name}
                          initialEnabled={isGranted}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(users ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="size-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-medium text-foreground">
                        {search ? "No matching officers found" : "No approved officers found"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
