"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  Calendar,
  Clock,
  FileText,
  Briefcase,
  Sliders,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { getUserDataCounts, deleteUser, type UserDataCounts } from "@/actions/users";
import { useToast } from "@/components/ui/toast";

export interface DeleteUserModalProps {
  userId: string;
  userName: string;
  userRole?: string;
  isCurrentUser?: boolean;
  variant?: "table-action" | "mobile-card" | "detail-danger";
  redirectTo?: string;
}

export function DeleteUserModal({
  userId,
  userName,
  userRole,
  isCurrentUser = false,
  variant = "table-action",
  redirectTo,
}: DeleteUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<UserDataCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const { toast } = useToast();

  useBodyScrollLock(isOpen);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) {
        handleClose();
      }
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending]);

  const handleOpen = async () => {
    setIsOpen(true);
    setConfirmInput("");
    setErrorMessage(null);
    setIsLoadingCounts(true);

    try {
      const data = await getUserDataCounts(userId);
      setCounts(data);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to calculate officer data counts.");
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setCounts(null);
    setConfirmInput("");
    setErrorMessage(null);
  };

  const isConfirmed =
    confirmInput.trim().toUpperCase() === "DELETE" ||
    confirmInput.trim().toLowerCase() === userName.trim().toLowerCase();

  const handleDelete = () => {
    if (!isConfirmed || isPending) return;
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await deleteUser(userId);
        toast(res.message, "success");
        setIsOpen(false);

        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } catch (err: unknown) {
        setErrorMessage((err as Error).message || "Failed to delete officer. Please try again.");
      }
    });
  };

  // Prevent Super Admin from deleting their own account
  if (isCurrentUser) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      {variant === "table-action" && (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shadow-2xs cursor-pointer"
          title={`Delete ${userName} and associated data`}
        >
          <Trash2 className="size-3" />
          <span>Delete</span>
        </button>
      )}

      {variant === "mobile-card" && (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Officer</span>
        </button>
      )}

      {variant === "detail-danger" && (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
        >
          <Trash2 className="size-4" />
          <span>Delete Officer & Wipe Records</span>
        </button>
      )}

      {/* Confirmation Modal */}
      {isOpen && (
        <ModalPortal>
          <div
            onClick={handleClose}
            className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in-0 duration-150`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl p-5 sm:p-6 space-y-4 my-8 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                    <ShieldAlert className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      Delete Officer & Cleanup Data
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Target: <span className="font-semibold text-foreground">{userName}</span>
                      {userRole && <span className="ml-1 text-[11px] font-mono text-indigo-500">({userRole})</span>}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleClose}
                  className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Error notice if any */}
              {errorMessage && (
                <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Data Count Inspection Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Associated Records to be Deleted:
                  </h4>
                  {isLoadingCounts && (
                    <span className="flex items-center gap-1.5 text-xs text-indigo-500">
                      <Loader2 className="size-3 animate-spin" />
                      <span>Scanning database...</span>
                    </span>
                  )}
                </div>

                {isLoadingCounts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : counts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* Duties Card */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Clock className="size-3.5 text-blue-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.dutiesCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">Duties Logged</div>
                      {counts.taCount > 0 && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {counts.taCount} with TA Claim
                        </div>
                      )}
                    </div>

                    {/* Leave Records Card */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Calendar className="size-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.leavesCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">Leave Logs</div>
                      <div className="text-[10px] text-muted-foreground">
                        {counts.leaveBalancesCount} balance types
                      </div>
                    </div>

                    {/* Storage Files Card */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <FileText className="size-3.5 text-purple-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.filesCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">Cloud Files</div>
                      <div className="text-[10px] text-muted-foreground">in Storage Bucket</div>
                    </div>

                    {/* Timeline Milestones Card */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Briefcase className="size-3.5 text-indigo-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.timelineCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">Career Timeline</div>
                      <div className="text-[10px] text-muted-foreground">postings & events</div>
                    </div>

                    {/* Holidays Card */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Calendar className="size-3.5 text-rose-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.holidaysCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">User Holidays</div>
                      <div className="text-[10px] text-muted-foreground">custom schedule</div>
                    </div>

                    {/* Settings & Permissions */}
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Sliders className="size-3.5 text-emerald-500" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {counts.permissionsCount}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground">Permissions</div>
                      <div className="text-[10px] text-muted-foreground">
                        {counts.hasSettings ? "Custom settings" : "Default config"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Data Isolation Guarantee */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Strict Data Isolation Guarantee</span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed block">
                    Only this officer&apos;s records will be deleted. All other officers, department configurations, and database tables will remain completely safe and untouched.
                  </span>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-foreground block">
                  To confirm, type <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">DELETE</span> or the officer&apos;s name:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={`Type "${userName}" or "DELETE"`}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all font-mono"
                  autoFocus
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/80">
                {/* Option 1: Leave it (Safe button) */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Leave It
                </button>

                {/* Option 2: Permanently Delete (Destructive action) */}
                <button
                  type="button"
                  disabled={!isConfirmed || isPending}
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Deleting All Records...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
