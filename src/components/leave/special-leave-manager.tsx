"use client";

import { useState, useActionState, useTransition, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavLink as Link } from "@/components/ui/nav-link";
import {
  applySpecialLeave,
  approveSpecialLeave,
  cancelSpecialLeaveApplication,
  editSpecialLeaveApplication,
  deleteSpecialLeaveApplication,
  type LeaveFormState,
} from "@/actions/leave";
import type { SpecialLeaveApplicationStatus } from "@/types/database";
import {
  calculateSpecialLeaveCommittedDays,
  calculateSpecialLeaveAvailableToApply,
  calculateFifoDeduction,
  computeSpecialLeaveExpiry,
  isSpecialLeaveSanctionExpired,
  sanctionRangeDays,
} from "@/lib/leave/specialLeaveRules";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { FieldError } from "@/components/ui/field-error";
import { FormSelect } from "@/components/ui/form-select";
import {
  ShieldCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  FileText,
  UserCheck,
  Ban,
  Scale,
  Sparkles,
  Layers,
  Pencil,
  Trash2,
  RotateCcw,
  ListFilter,
} from "lucide-react";

export type ApprovalLeaveType = {
  id: string;
  name: string;
  code: string;
  color?: string | null;
};

export type SpecialLeaveAppItem = {
  id: string;
  leave_type_id?: string | null;
  leave_type?: {
    name: string;
    code: string;
    color?: string | null;
  } | null;
  applied_date: string;
  applied_days: number;
  reason: string | null;
  status: SpecialLeaveApplicationStatus;
  approved_date: string | null;
  approved_by: string | null;
  approved_days: number | null;
  order_no: string | null;
  logged_days: number;
  valid_from?: string | null;
  valid_to?: string | null;
  expires_at?: string | null;
};

/**
 * Opening values for the apply modal when reapplying.
 *
 * A rejected or cancelled application is usually resubmitted almost
 * unchanged -- a new date, sometimes a different day count or reason -- so
 * reapplying opens the ordinary apply form carrying the old values rather
 * than making the officer retype them. It submits through the same action as
 * a fresh application, so the same quota and date rules apply, and the old
 * record is left alone as history.
 */
export type ApplyPrefill = {
  leaveTypeId?: string | null;
  appliedDays: number;
  reason: string | null;
  validFrom?: string | null;
  validTo?: string | null;
};

export type SpecialLeaveBalanceInfo = {
  year: number;
  allocated: number;
  carriedIn: number;
  totalAvailable: number;
  used: number;
  remaining: number;
  splTypeId?: string;
};

export function SpecialLeaveManager({
  applications,
  balance,
  approvalLeaveTypes = [],
  autoOpenApply = false,
}: {
  applications: SpecialLeaveAppItem[];
  balance: SpecialLeaveBalanceInfo;
  approvalLeaveTypes?: ApprovalLeaveType[];
  /** The page header's "Apply for Sanction" button sets ?apply=1. The modal
   *  lives here, so the URL is how the header reaches it. */
  autoOpenApply?: boolean;
}) {
  const [applyModalOpen, setApplyModalOpen] = useState(autoOpenApply);
  const [applyPrefill, setApplyPrefill] = useState<ApplyPrefill | null>(null);
  const [approveTarget, setApproveTarget] = useState<SpecialLeaveAppItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SpecialLeaveAppItem | null>(null);
  const [editTarget, setEditTarget] = useState<SpecialLeaveAppItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpecialLeaveAppItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | SpecialLeaveApplicationStatus>("ALL");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<
    { text: string; tone: "success" | "error" } | null
  >(null);

  // Apply form state
  const [applyState, applyAction, applyPending] = useActionState(
    async (prev: any, formData: FormData) => {
      const res = await applySpecialLeave(prev, formData);
      if (res?.ok) {
        closeApplyModal();
        setActionMessage({
          text: res.message ?? "Leave application submitted.",
          tone: "success",
        });
      }
      return res;
    },
    undefined,
  );

  // Approve form state
  const [approveState, approveAction, approvePending] = useActionState(
    async (prev: any, formData: FormData) => {
      if (!approveTarget) return prev;
      const res = await approveSpecialLeave(approveTarget.id, prev, formData);
      if (res?.ok) {
        setApproveTarget(null);
        setActionMessage({ text: "Sanction recorded successfully.", tone: "success" });
      }
      return res;
    },
    undefined,
  );

  const [editState, editAction, editPending] = useActionState(
    async (prev: LeaveFormState, formData: FormData) => {
      if (!editTarget) return prev;
      const res = await editSpecialLeaveApplication(editTarget.id, prev, formData);
      if (res?.ok) {
        setEditTarget(null);
        setActionMessage({
          text: res.message ?? "Leave sanction updated.",
          tone: "success",
        });
      }
      return res;
    },
    undefined,
  );

  const confirmDeleteAction = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteSpecialLeaveApplication(target.id);
      setActionMessage(
        res.success
          ? { text: "Leave sanction deleted.", tone: "success" }
          : {
            text: res.message || "Failed to delete this application.",
            tone: "error",
          },
      );
    });
  };

  /**
   * Days locked up against the Special Leave quota.
   *
   * Filtered to the SPL type, the way the server already filters it. Without
   * that, Binpagari applications -- which answer to a sanction and to no
   * annual quota at all -- were counted against the Special Leave balance, so
   * "available to apply" read lower here than the server would allow.
   */
  const committedDays = calculateSpecialLeaveCommittedDays(
    applications.map((a) => ({
      leave_type_id: a.leave_type_id ?? undefined,
      status: a.status,
      applied_days: a.applied_days,
      approved_days: a.approved_days,
      logged_days: a.logged_days,
      approved_date: a.approved_date,
      expires_at: a.expires_at,
      valid_from: a.valid_from,
      valid_to: a.valid_to,
    })),
    new Date(),
    balance.splTypeId,
  );

  const availableToApply = calculateSpecialLeaveAvailableToApply(
    balance.totalAvailable,
    balance.used,
    committedDays,
  );

  const fifo = calculateFifoDeduction(
    balance.used,
    balance.carriedIn,
    balance.allocated,
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (autoOpenApply) setApplyModalOpen(true);
  }, [autoOpenApply]);

  const openReapply = (app: SpecialLeaveAppItem) => {
    setApplyPrefill({
      leaveTypeId: app.leave_type_id,
      appliedDays: app.applied_days,
      reason: app.reason,
      validFrom: app.valid_from,
      validTo: app.valid_to,
    });
    setApplyModalOpen(true);
  };

  const closeApplyModal = () => {
    setApplyModalOpen(false);
    setApplyPrefill(null);
    // Leave ?apply=1 behind and the button would be a no-op the second time.
    if (searchParams?.get("apply")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("apply");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const confirmCancelAction = () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelTarget(null);
    startTransition(async () => {
      const res = await cancelSpecialLeaveApplication(target.id);
      setActionMessage(
        res.success
          ? { text: "Application cancelled and quota released.", tone: "success" }
          : {
            text: res.message || "Failed to cancel application.",
            tone: "error",
          },
      );
    });
  };

  const statusCounts = applications.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const visibleApplications =
    statusFilter === "ALL"
      ? applications
      : applications.filter((a) => a.status === statusFilter);

  const FILTERS: { value: "ALL" | SpecialLeaveApplicationStatus; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const getStatusBadge = (status: SpecialLeaveApplicationStatus) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="success" dot>Approved</Badge>;
      case "PENDING":
        return <Badge variant="warning" dot>Pending Approval</Badge>;
      case "REJECTED":
        return <Badge variant="secondary">Rejected</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {actionMessage && (
        <AutoDismissBanner
          message={actionMessage.text}
          tone={actionMessage.tone}
          autoHideMs={5000}
          // Clearing the state is what stops a message coming back: the banner
          // only remembers what it dismissed for as long as it stays mounted,
          // and a revalidate or a tab switch remounts it.
          onDismiss={() => setActionMessage(null)}
        />
      )}

      {/* Overview & Balance Cards. On a phone these stacked into three
          full-height cards and pushed the actual application list off the
          screen, so the two headline numbers share a row and the FIFO
          breakdown -- which is reference detail -- drops below them. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {/* Card 1: Total Available & Remaining */}
        <Card className="p-2.5 sm:p-3.5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-linear-to-br from-card to-card/60">
          <div>
            <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              <span className="sm:hidden">Total Quota</span>
              <span className="hidden sm:inline">Total Available Quota</span>
              <Scale className="size-3.5 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-foreground">
                {balance.totalAvailable}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">days</span>
            </div>
          </div>
          <div className="mt-2 pt-1.5 sm:mt-2.5 sm:pt-2 border-t border-border/70 flex items-center justify-between gap-1 text-[11px]">
            <span className="text-muted-foreground">
              <span className="sm:hidden">Used:</span>
              <span className="hidden sm:inline">Used / Logged:</span>
            </span>
            <span className="font-semibold text-foreground">{balance.used} days</span>
          </div>
        </Card>

        {/* Card 2: FIFO Breakdown (Carry Forward + Current Year) */}
        <Card className="col-span-2 order-last sm:order-none sm:col-span-1 p-2.5 sm:p-3.5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-linear-to-br from-card to-card/60">
          <div>
            <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              <span>FIFO Consumption</span>
              <Layers className="size-3.5 text-emerald-500" />
            </div>
            <div className="flex gap-3 sm:block sm:space-y-1 text-[11px]">
              <div className="flex-1 flex justify-between items-center gap-1.5">
                <span className="text-muted-foreground">Carry Forward:</span>
                <span className="font-semibold text-foreground">
                  {fifo.remainingCarryForward} / {balance.carriedIn} left
                </span>
              </div>
              <div className="flex-1 flex justify-between items-center gap-1.5">
                <span className="text-muted-foreground">Current Year:</span>
                <span className="font-semibold text-foreground">
                  {fifo.remainingCurrentYear} / {balance.allocated} left
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 pt-3 border-t border-border/70 text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
            <Sparkles className="size-3 text-emerald-500" />
            <span>Carry forward is debited before current year</span>
          </p>
        </Card>

        {/* Card 3: Uncommitted Quota Available to Apply */}
        <Card className="p-2.5 sm:p-3.5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-linear-to-br from-indigo-500/5 to-purple-500/5">
          <div>
            <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1.5">
              <span className="sm:hidden">To Apply</span>
              <span className="hidden sm:inline">Available to Apply</span>
              <ShieldCheck className="size-3.5 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {availableToApply}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">uncommitted</span>
            </div>
          </div>
          <div className="mt-2 pt-1.5 sm:mt-2.5 sm:pt-2 border-t border-border/70 flex items-center justify-between gap-1 text-[11px]">
            <span className="text-muted-foreground">
              <span className="sm:hidden">Committed:</span>
              <span className="hidden sm:inline">Committed / Pending:</span>
            </span>
            <span className="font-semibold text-foreground">{committedDays} days</span>
          </div>
        </Card>
      </div>

      {/* Header & Apply Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Leave Approvals & Sanctions (રજા મંજૂરી)</h2>
          <p className="text-xs text-muted-foreground">
            Official sanctions required before Special Leave or Binpagari Leave (બિનપગારી રજા) can be logged.
          </p>
        </div>
      </div>

      {/* Status filter. Hidden when there is nothing to filter. */}
      {applications.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <ListFilter className="size-4 shrink-0 text-muted-foreground" />
          {FILTERS.map((f) => {
            const count =
              f.value === "ALL" ? applications.length : statusCounts[f.value] ?? 0;
            const active = statusFilter === f.value;
            // A status nobody has is not worth a button.
            if (count === 0 && f.value !== "ALL" && !active) return null;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${active
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
              >
                <span>{f.label}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] leading-4 ${active ? "bg-white/25" : "bg-muted text-foreground"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Applications List */}
      {applications.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <FileText className="size-8 text-muted-foreground/60 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No Leave Applications or Sanctions</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            You have not applied for any Special Leave or Binpagari Leave in {balance.year}. When you apply or receive an official sanction order, record it here to log leave days.
          </p>
          <button
            type="button"
            onClick={() => setApplyModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <span>Apply for Leave Sanction now</span>
            <ArrowRight className="size-3.5" />
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleApplications.length === 0 && (
            <Card className="p-8 text-center space-y-2">
              <FileText className="size-7 text-muted-foreground/60 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                No {statusFilter.toLowerCase()} applications
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Show all applications
              </button>
            </Card>
          )}
          {visibleApplications.map((app) => {
            const approvedCount = app.approved_days ?? 0;
            const remainingToTake = Math.max(0, approvedCount - app.logged_days);
            const isExpired = app.status === "APPROVED" && isSpecialLeaveSanctionExpired(app);
            const expiryDate =
              app.expires_at || (app.approved_date ? computeSpecialLeaveExpiry(app.approved_date) : null);
            const isFullyTaken = app.status === "APPROVED" && remainingToTake === 0;
            const targetTypeId = app.leave_type_id || balance.splTypeId;

            return (
              <Card
                key={app.id}
                className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 md:gap-6 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
              >
                {/* === MOBILE CONTENT (md:hidden) === */}
                <div className="space-y-2.5 flex-1 min-w-0 md:hidden">
                  {/* Top row: Badges and Expiry tag */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getStatusBadge(app.status)}
                      {app.leave_type && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                          {app.leave_type.color && (
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: app.leave_type.color }}
                            />
                          )}
                          <span>{app.leave_type.name}</span>
                        </span>
                      )}
                      {app.order_no && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                          Order #{app.order_no}
                        </span>
                      )}
                    </div>

                    {app.status === "APPROVED" && (
                      isExpired ? (
                        <Badge variant="danger" dot className="text-[10px]">
                          Expired on {expiryDate}
                        </Badge>
                      ) : (
                        expiryDate && (
                          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Expires on {expiryDate}
                          </span>
                        )
                      )
                    )}
                  </div>

                  {/* Application Info: Applied Date & Validity */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-foreground">
                      Applied: <strong className="font-bold">{app.applied_days} day{app.applied_days === 1 ? "" : "s"}</strong> on {app.applied_date}
                    </span>
                    {app.valid_from && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
                        Valid: {app.valid_from} {app.valid_to ? `to ${app.valid_to}` : "onwards"}
                      </span>
                    )}
                  </div>

                  {app.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      &ldquo;{app.reason}&rdquo;
                    </p>
                  )}

                  {/* Approved Details & Clean 3-part Stat Grid for Mobile */}
                  {app.status === "APPROVED" && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserCheck className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">
                          Approved by: <strong className="text-foreground font-semibold">{app.approved_by}</strong> ({app.approved_date})
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/60 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Approved</span>
                          <span className="text-xs font-bold text-foreground">
                            {app.approved_days} <span className="text-[10px] font-normal text-muted-foreground">days</span>
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center border-x border-border/50">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Taken</span>
                          <span className="text-xs font-bold text-foreground">
                            {app.logged_days} <span className="text-[10px] font-normal text-muted-foreground">days</span>
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">Remaining</span>
                          <span className={`text-xs font-black ${isExpired ? "text-rose-500 line-through" : "text-indigo-600 dark:text-indigo-400"}`}>
                            {remainingToTake} <span className="text-[10px] font-normal text-muted-foreground">days</span>
                          </span>
                          {isExpired && <span className="text-[9px] text-rose-500 font-bold leading-none mt-0.5">(lapsed)</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* === DESKTOP CONTENT (hidden md:block) === */}
                <div className="hidden md:block space-y-1.5 flex-1 min-w-0">
                  {/* Row 1: Badges, Applied, Order, Validity, Expiry all inline */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(app.status)}
                    {app.leave_type && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
                        {app.leave_type.color && (
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: app.leave_type.color }}
                          />
                        )}
                        <span>{app.leave_type.name}</span>
                      </span>
                    )}
                    <span className="text-xs font-bold text-foreground">
                      Applied: {app.applied_days} day{app.applied_days === 1 ? "" : "s"} on {app.applied_date}
                    </span>
                    {app.order_no && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                        Order #{app.order_no}
                      </span>
                    )}
                    {app.valid_from && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
                        Valid: {app.valid_from} {app.valid_to ? `to ${app.valid_to}` : "onwards"}
                      </span>
                    )}
                    {app.status === "APPROVED" && (
                      isExpired ? (
                        <Badge variant="danger" dot>Expired on {expiryDate}</Badge>
                      ) : (
                        expiryDate && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                            Expires on {expiryDate}
                          </span>
                        )
                      )
                    )}
                  </div>

                  {app.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-1 italic">
                      &ldquo;{app.reason}&rdquo;
                    </p>
                  )}

                  {/* Row 2: Approved by + Approved / Taken / Remaining inline */}
                  {app.status === "APPROVED" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCheck className="size-3.5 text-emerald-500 shrink-0" />
                        <span>
                          Approved by: <strong className="text-foreground font-semibold">{app.approved_by}</strong> ({app.approved_date})
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 text-indigo-500 shrink-0" />
                        <span>
                          Approved: <strong className="text-foreground font-semibold">{app.approved_days}</strong> days
                          {" • "}
                          Taken: <strong className="text-foreground font-semibold">{app.logged_days}</strong> days
                          {" • "}
                          Remaining to log:{" "}
                          <strong className={isExpired ? "text-rose-500 line-through" : "text-indigo-600 dark:text-indigo-400 font-bold"}>
                            {remainingToTake}
                          </strong>{" "}
                          days {isExpired && <span className="text-[11px] text-rose-500 font-semibold">(lapsed)</span>}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* === ACTIONS CONTAINER (Responsive) === */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 pt-2 md:pt-0 border-t border-border/50 md:border-0 shrink-0">
                  {/* Primary Actions */}
                  {app.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => setApproveTarget(app)}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                    >
                      <UserCheck className="size-3.5" />
                      <span>Record Sanction</span>
                    </button>
                  )}

                  {app.status === "APPROVED" && isExpired && (
                    <span className="text-center text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1.5 md:py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                      Expired (6 Months Reached)
                    </span>
                  )}

                  {app.status === "APPROVED" && !isExpired && remainingToTake > 0 && targetTypeId && (
                    <Link
                      href={`/leave/new?leaveTypeId=${targetTypeId}&specialLeaveApplicationId=${app.id}`}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      <span>Log Leave</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}

                  {isFullyTaken && (
                    <Badge variant="secondary" className="justify-center py-1">Fully Taken</Badge>
                  )}

                  {(app.status === "REJECTED" || app.status === "CANCELLED") && (
                    <button
                      type="button"
                      onClick={() => openReapply(app)}
                      disabled={isPending}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Reapply</span>
                    </button>
                  )}

                  {/* Secondary Actions Row: Cancel, Edit, Delete */}
                  <div className="flex items-center gap-1.5 w-full md:w-auto">
                    {app.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(app)}
                        disabled={isPending}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-rose-500 hover:border-rose-300 transition-colors cursor-pointer"
                      >
                        <Ban className="size-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {app.status === "APPROVED" && app.logged_days === 0 && !isExpired && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(app)}
                        disabled={isPending}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-rose-500 hover:border-rose-300 transition-colors cursor-pointer"
                      >
                        <Ban className="size-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {(app.status === "PENDING" || app.status === "APPROVED") && (
                      <button
                        type="button"
                        onClick={() => setEditTarget(app)}
                        disabled={isPending}
                        aria-label="Edit this sanction"
                        title="Edit"
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-indigo-600 hover:border-indigo-300 transition-colors cursor-pointer"
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(app)}
                      disabled={isPending || app.logged_days > 0}
                      aria-label="Delete this sanction"
                      title={
                        app.logged_days > 0
                          ? "Leave is already logged against this sanction"
                          : "Delete"
                      }
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-border"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal 1: Apply for Leave Sanction */}
      {applyModalOpen && (
        <ModalPortal>
          <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${MODAL_Z}`}>
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {applyPrefill ? "Reapply for Leave Sanction" : "Apply / Record Leave Sanction"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    {applyPrefill
                      ? "Carried over from the earlier application. Change what you need, or submit as is."
                      : "Submit application or record approved order for Special / Binpagari Leave."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeApplyModal}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {applyState?.message && (
                <AutoDismissBanner message={applyState.message} tone="error" />
              )}

              <ApplyForm
                // Remounts between a blank apply and a reapply, so the
                // carried-over values become the form's initial state.
                key={applyPrefill ? "reapply" : "apply"}
                action={applyAction}
                pending={applyPending}
                availableToApply={availableToApply}
                approvalLeaveTypes={approvalLeaveTypes}
                defaultLeaveTypeId={applyPrefill?.leaveTypeId ?? balance.splTypeId}
                prefill={applyPrefill}
                onClose={closeApplyModal}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: Confirm Cancel Modal (Replaces browser window.confirm) */}
      {cancelTarget && (
        <ModalPortal>
          <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${MODAL_Z}`}>
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertCircle className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Cancel Leave Application?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to cancel this {cancelTarget.leave_type?.name ?? "leave"} application of{" "}
                    <strong className="text-foreground font-semibold">{cancelTarget.applied_days} day(s)</strong> applied on {cancelTarget.applied_date}?
                  </p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    The committed days will immediately be returned to your uncommitted quota.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isPending}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted cursor-pointer transition-colors"
                >
                  Keep Application
                </button>
                <button
                  type="button"
                  onClick={confirmCancelAction}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                  <span>Yes, Cancel Application</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 2: Record Sanction / Approval for Pending Application */}
      {approveTarget && (
        <ModalPortal>
          <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${MODAL_Z}`}>
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Record Sanction / Approval</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    Applied: {approveTarget.applied_days} days on {approveTarget.applied_date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {approveState?.message && (
                <AutoDismissBanner message={approveState.message} tone="error" />
              )}

              <ApproveForm
                approveTarget={approveTarget}
                action={approveAction}
                pending={approvePending}
                onClose={() => setApproveTarget(null)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 3: Edit an existing application or sanction */}
      {editTarget && (
        <ModalPortal>
          <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${MODAL_Z}`}>
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Edit {editTarget.status === "APPROVED" ? "Sanction" : "Application"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    {editTarget.leave_type?.name ?? "Leave"} &middot; applied{" "}
                    {editTarget.applied_date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  &#10005;
                </button>
              </div>

              {editState?.message && (
                <AutoDismissBanner message={editState.message} tone="error" />
              )}

              <EditForm
                editTarget={editTarget}
                approvalLeaveTypes={approvalLeaveTypes}
                action={editAction}
                pending={editPending}
                onClose={() => setEditTarget(null)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 4: Confirm delete */}
      {deleteTarget && (
        <ModalPortal>
          <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${MODAL_Z}`}>
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Delete this {deleteTarget.status === "APPROVED" ? "sanction" : "application"}?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {deleteTarget.applied_days} day(s) applied on {deleteTarget.applied_date}
                    {deleteTarget.approved_by ? `, sanctioned by ${deleteTarget.approved_by}` : ""}.
                  </p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    This removes the record permanently and cannot be undone. To keep
                    the record but release its quota, use Cancel instead.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted cursor-pointer"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Delete permanently</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

/**
 * Edits an application in place. A PENDING one exposes only what was applied
 * for; an APPROVED one also exposes the sanction itself, which cannot be cut
 * below the days already logged against it (the server checks that too).
 */
function EditForm({
  editTarget,
  approvalLeaveTypes = [],
  action,
  pending,
  onClose,
}: {
  editTarget: SpecialLeaveAppItem;
  approvalLeaveTypes?: ApprovalLeaveType[];
  action: (formData: FormData) => void;
  pending: boolean;
  onClose: () => void;
}) {
  const isApproved = editTarget.status === "APPROVED";
  // Reclassifying is only offered while nothing has been logged -- the server
  // refuses it afterwards, and an option that always fails is worse than none.
  const canChangeType = editTarget.logged_days === 0 && approvalLeaveTypes.length > 1;
  const [leaveTypeId, setLeaveTypeId] = useState(
    editTarget.leave_type_id ?? approvalLeaveTypes[0]?.id ?? "",
  );

  const [appliedDate, setAppliedDate] = useState(editTarget.applied_date);
  const [appliedDays, setAppliedDays] = useState(String(editTarget.applied_days));
  const [reason, setReason] = useState(editTarget.reason ?? "");
  const [orderNo, setOrderNo] = useState(editTarget.order_no ?? "");
  const [validFrom, setValidFrom] = useState(editTarget.valid_from ?? "");
  const [validTo, setValidTo] = useState(editTarget.valid_to ?? "");
  const [approvedDate, setApprovedDate] = useState(editTarget.approved_date ?? "");
  const [approvedBy, setApprovedBy] = useState(editTarget.approved_by ?? "");
  const [approvedDays, setApprovedDays] = useState(
    String(editTarget.approved_days ?? editTarget.applied_days),
  );
  const [submitted, setSubmitted] = useState(false);

  // Same rule as the other two forms: a fixed window fills the day count in,
  // and the officer may still override it. Editing opens on saved values, so
  // the range it opened with counts as already applied -- only a change from
  // here refills the count.
  const rangeDays = sanctionRangeDays(validFrom, validTo);
  const lastFilledRange = useRef<string | null>(
    sanctionRangeDays(editTarget.valid_from, editTarget.valid_to) === null
      ? null
      : `${editTarget.valid_from}|${editTarget.valid_to}`,
  );
  useEffect(() => {
    const span = sanctionRangeDays(validFrom, validTo);
    if (span === null) {
      lastFilledRange.current = null;
      return;
    }
    const key = `${validFrom}|${validTo}`;
    if (lastFilledRange.current === key) return;
    lastFilledRange.current = key;
    setAppliedDays(String(span));
    if (isApproved) setApprovedDays(String(span));
  }, [validFrom, validTo, isApproved]);

  const numApplied = parseFloat(appliedDays);
  const numApproved = parseFloat(approvedDays);
  const loggedDays = editTarget.logged_days;

  let appliedError: string | null = null;
  if (isNaN(numApplied) || numApplied <= 0) {
    appliedError = "Applied days must be greater than 0.";
  }

  let approvedError: string | null = null;
  if (isApproved) {
    if (isNaN(numApproved) || numApproved <= 0) {
      approvedError = "Approved days must be greater than 0.";
    } else if (!isNaN(numApplied) && numApproved > numApplied) {
      approvedError = `Approved days (${numApproved}) cannot exceed applied days (${numApplied} days).`;
    } else if (numApproved < loggedDays) {
      approvedError = `Cannot reduce below ${loggedDays} day${loggedDays === 1 ? "" : "s"
        } already logged against this sanction.`;
    }
  }

  const byError =
    isApproved && submitted && !approvedBy.trim()
      ? "Please enter the sanctioning authority or office."
      : null;

  const dateRangeError =
    validFrom && validTo && validTo < validFrom
      ? "'Valid To' date cannot be before 'Valid From' date."
      : null;

  // Advisory only, exactly as in the other forms.
  const rangeMismatch = (n: number, error: string | null) =>
    !error && rangeDays !== null && !isNaN(n) && n !== rangeDays
      ? `Sanction range spans ${rangeDays} day${rangeDays === 1 ? "" : "s"} (${validFrom} to ${validTo}) but ${n} day${n === 1 ? "" : "s"
      } ${n === 1 ? "is" : "are"} entered.`
      : null;
  const appliedRangeWarning = rangeMismatch(numApplied, appliedError);
  const approvedRangeWarning = isApproved
    ? rangeMismatch(numApproved, approvedError)
    : null;

  const isValid =
    !appliedError &&
    !dateRangeError &&
    Boolean(appliedDate) &&
    (!isApproved ||
      (!approvedError && Boolean(approvedBy.trim()) && Boolean(approvedDate)));

  const expiryPreview =
    isApproved && approvedDate ? computeSpecialLeaveExpiry(approvedDate) : "";

  const handleSubmit = (formData: FormData) => {
    setSubmitted(true);
    if (!isValid) return;
    action(formData);
  };

  const inputClass = (invalid: boolean) =>
    `w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${invalid
      ? "border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
      : "border-border focus:border-indigo-500"
    }`;

  const warningLine = (text: string) => (
    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
      <AlertCircle className="size-3.5 shrink-0 mt-px" />
      <span>{text}</span>
    </p>
  );

  return (
    <form noValidate action={handleSubmit} className="space-y-4">
      {canChangeType ? (
        <div className="space-y-1.5">
          <label htmlFor="editLeaveTypeId" className="text-xs font-semibold text-foreground">
            Leave Classification
          </label>
          <FormSelect
            id="editLeaveTypeId"
            name="leaveTypeId"
            value={leaveTypeId}
            onChange={setLeaveTypeId}
            placeholder="Select leave classification"
            options={approvalLeaveTypes.map((t) => ({
              value: t.id,
              label: t.name,
              color: t.color,
            }))}
          />
        </div>
      ) : (
        <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="editAppliedDate" className="text-xs font-semibold text-foreground">
            Application Date
          </label>
          <input
            id="editAppliedDate"
            name="appliedDate"
            type="date"
            required
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className={inputClass(false)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="editAppliedDays" className="text-xs font-semibold text-foreground">
            Days Applied
          </label>
          <input
            id="editAppliedDays"
            name="appliedDays"
            type="number"
            step="0.5"
            min="0.5"
            value={appliedDays}
            onChange={(e) => setAppliedDays(e.target.value)}
            className={inputClass(Boolean(appliedError))}
          />
          {appliedError ? (
            <FieldError message={appliedError} />
          ) : appliedRangeWarning ? (
            warningLine(appliedRangeWarning)
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Sanction Date Range (Optional)</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            If fixed by sanction order
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="editValidFrom" className="text-[10px] text-muted-foreground">
              Valid From
            </label>
            <input
              id="editValidFrom"
              name="validFrom"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label htmlFor="editValidTo" className="text-[10px] text-muted-foreground">
              Valid To
            </label>
            <input
              id="editValidTo"
              name="validTo"
              type="date"
              value={validTo}
              min={validFrom || undefined}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>
        {dateRangeError && <FieldError message={dateRangeError} />}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="editReason" className="text-xs font-semibold text-foreground">
          Reason (Optional)
        </label>
        <textarea
          id="editReason"
          name="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="editOrderNo" className="text-xs font-semibold text-foreground">
          Sanction Order No. (Optional)
        </label>
        <input
          id="editOrderNo"
          name="orderNo"
          type="text"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="e.g. SPL/2026/894"
          className={inputClass(false)}
        />
      </div>

      {isApproved && (
        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <UserCheck className="size-3.5 shrink-0" />
            <span>Sanction Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="editApprovedDate" className="text-xs font-semibold text-foreground">
                Sanction Date
              </label>
              <input
                id="editApprovedDate"
                name="approvedDate"
                type="date"
                value={approvedDate}
                onChange={(e) => setApprovedDate(e.target.value)}
                className={inputClass(false)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="editApprovedDays" className="text-xs font-semibold text-foreground">
                Approved Days
              </label>
              <input
                id="editApprovedDays"
                name="approvedDays"
                type="number"
                step="0.5"
                min="0.5"
                value={approvedDays}
                onChange={(e) => setApprovedDays(e.target.value)}
                className={inputClass(Boolean(approvedError))}
              />
              {approvedError ? (
                <FieldError message={approvedError} />
              ) : approvedRangeWarning ? (
                warningLine(approvedRangeWarning)
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="editApprovedBy" className="text-xs font-semibold text-foreground">
              Approving Authority / Office
            </label>
            <input
              id="editApprovedBy"
              name="approvedBy"
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="e.g. D.S.P. Office"
              className={inputClass(Boolean(byError))}
            />
            {byError && <FieldError message={byError} />}
          </div>

          {loggedDays > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {loggedDays} day{loggedDays === 1 ? "" : "s"} already logged against this
              sanction, so it cannot be reduced below that.
            </p>
          )}

          {expiryPreview && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
              <Clock className="size-3.5 text-amber-500 shrink-0 mt-px" />
              <span>
                Changing the sanction date moves the 6-month expiry to{" "}
                <strong>{expiryPreview}</strong>.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            pending ||
            Boolean(appliedError) ||
            Boolean(dateRangeError) ||
            Boolean(approvedError)
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  );
}

function ApproveForm({
  approveTarget,
  action,
  pending,
  onClose,
}: {
  approveTarget: SpecialLeaveAppItem;
  action: (formData: FormData) => void;
  pending: boolean;
  onClose: () => void;
}) {
  const [approvedDate, setApprovedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedDays, setApprovedDays] = useState(
    String(approveTarget.applied_days),
  );
  const [orderNo, setOrderNo] = useState("");
  const [validFrom, setValidFrom] = useState(approveTarget.valid_from ?? "");
  const [validTo, setValidTo] = useState(approveTarget.valid_to ?? "");
  const [submitted, setSubmitted] = useState(false);

  const numDays = parseFloat(approvedDays);
  const maxDays = approveTarget.applied_days;

  // A sanction order that fixes the window also fixes the day count, so the
  // count follows the dates. It stays editable: a sanction may cover a wider
  // window than the days it grants, and the officer has the order in hand.
  const rangeDays = sanctionRangeDays(validFrom, validTo);
  const lastFilledRange = useRef<string | null>(null);
  useEffect(() => {
    const span = sanctionRangeDays(validFrom, validTo);
    if (span === null) {
      lastFilledRange.current = null;
      return;
    }
    const key = `${validFrom}|${validTo}`;
    if (lastFilledRange.current === key) return;
    lastFilledRange.current = key;
    setApprovedDays(String(span));
  }, [validFrom, validTo]);

  let daysError: string | null = null;
  if (isNaN(numDays) || numDays <= 0) {
    daysError = "Approved days must be greater than 0.";
  } else if (numDays > maxDays) {
    daysError = `Approved days (${numDays}) cannot exceed applied days (${maxDays} days).`;
  }

  // Advisory only — never blocks, and never reaches the submit button.
  const daysRangeWarning =
    !daysError && rangeDays !== null && numDays !== rangeDays
      ? `Sanction range spans ${rangeDays} day${rangeDays === 1 ? "" : "s"} (${validFrom} to ${validTo}) but ${numDays} day${numDays === 1 ? "" : "s"
      } ${numDays === 1 ? "is" : "are"} entered.`
      : null;

  const byError =
    submitted && !approvedBy.trim()
      ? "Please enter the approving authority or office."
      : null;

  const dateRangeError =
    validFrom && validTo && validTo < validFrom
      ? "'Valid To' date cannot be before 'Valid From' date."
      : null;

  const isValid =
    !daysError && !dateRangeError && Boolean(approvedBy.trim()) && Boolean(approvedDate);

  const expiryPreview = approvedDate ? computeSpecialLeaveExpiry(approvedDate) : "";

  const handleSubmit = (formData: FormData) => {
    setSubmitted(true);
    if (!isValid) return;
    action(formData);
  };

  return (
    <form noValidate action={handleSubmit} className="space-y-4">
      {/* Sanction Date */}
      <div className="space-y-1.5">
        <label htmlFor="approvedDate" className="text-xs font-semibold text-foreground">
          Sanction / Approval Date
        </label>
        <input
          id="approvedDate"
          name="approvedDate"
          type="date"
          required
          value={approvedDate}
          onChange={(e) => setApprovedDate(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden"
        />
      </div>

      {/* Approving Authority */}
      <div className="space-y-1.5">
        <label htmlFor="approvedBy" className="text-xs font-semibold text-foreground">
          Approving Authority / Office
        </label>
        <input
          id="approvedBy"
          name="approvedBy"
          type="text"
          required
          value={approvedBy}
          onChange={(e) => setApprovedBy(e.target.value)}
          placeholder="e.g. D.S.P. Office / Superintendent of Police"
          className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${byError
              ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "border-border focus:border-indigo-500"
            }`}
        />
        {byError && <FieldError message={byError} />}
      </div>

      {/* Approved Days with In-UI Validation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="approvedDays" className="text-xs font-semibold text-foreground">
            Approved Days (max {maxDays})
          </label>
          <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            Applied: {maxDays} {maxDays === 1 ? "day" : "days"}
          </span>
        </div>
        <input
          id="approvedDays"
          name="approvedDays"
          type="number"
          step="0.5"
          min="0.5"
          value={approvedDays}
          onChange={(e) => setApprovedDays(e.target.value)}
          className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${daysError
              ? "border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "border-border focus:border-indigo-500"
            }`}
        />
        {daysError ? (
          <FieldError message={daysError} />
        ) : daysRangeWarning ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-px" />
            <span>{daysRangeWarning}</span>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Sanction can be approved up to {maxDays} days. Logged days will deduct from this balance.
          </p>
        )}
      </div>

      {/* Optional Date Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Sanction Date Range (Optional)</span>
          <span className="text-[10px] text-muted-foreground font-normal">If fixed by sanction order</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="validFrom" className="text-[10px] text-muted-foreground">Valid From</label>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label htmlFor="validTo" className="text-[10px] text-muted-foreground">Valid To</label>
            <input
              id="validTo"
              name="validTo"
              type="date"
              value={validTo}
              min={validFrom || undefined}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>
        {dateRangeError && <FieldError message={dateRangeError} />}
      </div>

      {/* 6-Month Expiration Notice */}
      {expiryPreview && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Clock className="size-3.5 text-amber-500 shrink-0" />
            <span>6-Month Validity Rule</span>
          </div>
          <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
            This sanction automatically expires on <strong>{expiryPreview}</strong> (6 months from approval date). Any unlogged days after this date will lapse.
          </p>
        </div>
      )}

      {/* Order / Dispatch Number */}
      <div className="space-y-1.5">
        <label htmlFor="orderNo" className="text-xs font-semibold text-foreground">
          Sanction Order No. (Optional)
        </label>
        <input
          id="orderNo"
          name="orderNo"
          type="text"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="e.g. SPL/2026/894"
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          // Deliberately not `!isValid`: a blank authority must leave the button
          // clickable, because clicking is what reveals its error message.
          disabled={pending || Boolean(daysError) || Boolean(dateRangeError)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <span>Confirm Approval</span>
        </button>
      </div>
    </form>
  );
}

function ApplyForm({
  action,
  pending,
  availableToApply,
  approvalLeaveTypes = [],
  defaultLeaveTypeId,
  prefill = null,
  onClose,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  availableToApply: number;
  approvalLeaveTypes?: ApprovalLeaveType[];
  defaultLeaveTypeId?: string;
  prefill?: ApplyPrefill | null;
  onClose: () => void;
}) {
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>(() => {
    if (defaultLeaveTypeId) return defaultLeaveTypeId;
    const spl = approvalLeaveTypes.find((t) => t.code === "SPL");
    return spl?.id ?? approvalLeaveTypes[0]?.id ?? "";
  });

  const selectedType = approvalLeaveTypes.find((t) => t.id === selectedLeaveTypeId);
  const isLwp = selectedType?.code?.toUpperCase() === "LWP";

  const [hasSanction, setHasSanction] = useState(false);
  const [appliedDaysVal, setAppliedDaysVal] = useState(
    prefill ? String(prefill.appliedDays) : "1",
  );
  const [approvedDaysVal, setApprovedDaysVal] = useState(
    prefill ? String(prefill.appliedDays) : "1",
  );
  const [approvedDateVal, setApprovedDateVal] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [approvedBy, setApprovedBy] = useState("");
  const [validFrom, setValidFrom] = useState(prefill?.validFrom ?? "");
  const [validTo, setValidTo] = useState(prefill?.validTo ?? "");
  const [submitted, setSubmitted] = useState(false);

  // Same rule as the approval modal: a fixed window fills in the day count,
  // and the officer may still override it.
  const rangeDays = sanctionRangeDays(validFrom, validTo);
  // A reapply opens on the old application's range AND its old day count.
  // Seeding this with that range stops the effect below from immediately
  // snapping the carried-over count to the span on mount.
  const lastFilledRange = useRef<string | null>(
    prefill && sanctionRangeDays(prefill.validFrom, prefill.validTo) !== null
      ? `${prefill.validFrom}|${prefill.validTo}`
      : null,
  );
  useEffect(() => {
    const span = sanctionRangeDays(validFrom, validTo);
    if (span === null) {
      lastFilledRange.current = null;
      return;
    }
    const key = `${validFrom}|${validTo}`;
    if (lastFilledRange.current === key) return;
    lastFilledRange.current = key;
    setAppliedDaysVal(String(span));
    setApprovedDaysVal((curr) => (hasSanction ? String(span) : curr));
  }, [validFrom, validTo, hasSanction]);

  const numApplied = parseFloat(appliedDaysVal);
  let appliedError: string | null = null;
  if (isNaN(numApplied) || numApplied <= 0) {
    appliedError = "Applied days must be greater than 0.";
  } else if (!isLwp && numApplied > availableToApply) {
    appliedError = `Applied days (${numApplied}) exceeds available balance (${availableToApply} days).`;
  }

  const numApproved = parseFloat(approvedDaysVal);
  let approvedError: string | null = null;
  if (hasSanction) {
    if (isNaN(numApproved) || numApproved <= 0) {
      approvedError = "Approved days must be greater than 0.";
    } else if (!isNaN(numApplied) && numApproved > numApplied) {
      approvedError = `Approved days (${numApproved}) cannot exceed applied days (${numApplied} days).`;
    }
  }

  // Advisory only — neither warning blocks the submit.
  const rangeMismatch = (n: number, error: string | null) =>
    !error && rangeDays !== null && !isNaN(n) && n !== rangeDays
      ? `Sanction range spans ${rangeDays} day${rangeDays === 1 ? "" : "s"} (${validFrom} to ${validTo}) but ${n} day${n === 1 ? "" : "s"
      } ${n === 1 ? "is" : "are"} entered.`
      : null;
  const appliedRangeWarning = rangeMismatch(numApplied, appliedError);
  const approvedRangeWarning = hasSanction
    ? rangeMismatch(numApproved, approvedError)
    : null;

  const byError =
    hasSanction && submitted && !approvedBy.trim()
      ? "Please enter sanctioning authority / office."
      : null;

  const dateRangeError =
    validFrom && validTo && validTo < validFrom
      ? "'Valid To' date cannot be before 'Valid From' date."
      : null;

  const isValid =
    !appliedError &&
    !dateRangeError &&
    (!hasSanction || (!approvedError && Boolean(approvedBy.trim())));

  const sanctionExpiryPreview =
    hasSanction && approvedDateVal ? computeSpecialLeaveExpiry(approvedDateVal) : "";

  const handleSubmit = (formData: FormData) => {
    setSubmitted(true);
    if (!isValid) return;
    action(formData);
  };

  return (
    <form noValidate action={handleSubmit} className="space-y-4">
      {/* Leave Classification Picker */}
      {approvalLeaveTypes.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="leaveTypeId" className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Leave Classification</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {isLwp ? "Unpaid Leave (બિનપગારી)" : `Quota left: ${availableToApply} days`}
            </span>
          </label>
          <input type="hidden" name="leaveTypeId" value={selectedLeaveTypeId} />
          <FormSelect
            id="leaveTypeId"
            value={selectedLeaveTypeId}
            onChange={(val) => setSelectedLeaveTypeId(val)}
            placeholder="Select leave classification"
            options={approvalLeaveTypes.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.code})`,
              color: t.color,
            }))}
          />
          {isLwp && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-2 leading-tight">
              Binpagari Leave (બિનપગારી રજા / LWP) is Unpaid Leave. No salary, TA, or allowances are payable during this period.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="appliedDate" className="text-xs font-semibold text-foreground">
            Application Date
          </label>
          <input
            id="appliedDate"
            name="appliedDate"
            type="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="appliedDays" className="text-xs font-semibold text-foreground">
              Days Applied {isLwp ? "(count)" : `(max ${availableToApply})`}
            </label>
          </div>
          <input
            id="appliedDays"
            name="appliedDays"
            type="number"
            step="0.5"
            min="0.5"
            value={appliedDaysVal}
            onChange={(e) => {
              setAppliedDaysVal(e.target.value);
              if (hasSanction) setApprovedDaysVal(e.target.value);
            }}
            className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${appliedError
                ? "border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-border focus:border-indigo-500"
              }`}
          />
          {appliedError ? (
            <FieldError message={appliedError} />
          ) : appliedRangeWarning ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-px" />
              <span>{appliedRangeWarning}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Optional Date Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between gap-2">
          <span>{hasSanction ? "Sanction Date Range (Optional)" : "Leave Date Range (Optional)"}</span>
          <span className="text-[10px] text-muted-foreground font-normal text-right">
            {hasSanction ? "The window fixed by the order" : "Proposed or ordered dates"}
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="validFrom" className="text-[10px] text-muted-foreground">From</label>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label htmlFor="validTo" className="text-[10px] text-muted-foreground">To</label>
            <input
              id="validTo"
              name="validTo"
              type="date"
              value={validTo}
              min={validFrom || undefined}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>
        {dateRangeError && <FieldError message={dateRangeError} />}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reason" className="text-xs font-semibold text-foreground">
          Reason / Subject (Optional)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          defaultValue={prefill?.reason ?? ""}
          placeholder="e.g. Official special duty assignment, family event, medical sanction"
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden resize-none"
        />
      </div>

      {/* Sanction Details Toggle */}
      <div className="rounded-xl border border-border p-3.5 bg-muted/40 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="isApproved"
            value="true"
            checked={hasSanction}
            onChange={(e) => {
              setHasSanction(e.target.checked);
              if (e.target.checked) setApprovedDaysVal(appliedDaysVal);
            }}
            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs font-semibold text-foreground">
            I already have the official sanction order
          </span>
        </label>

        {hasSanction && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="approvedDate" className="text-xs font-semibold text-foreground">
                  Sanction Date
                </label>
                <input
                  id="approvedDate"
                  name="approvedDate"
                  type="date"
                  required={hasSanction}
                  value={approvedDateVal}
                  onChange={(e) => setApprovedDateVal(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="approvedDays" className="text-xs font-semibold text-foreground">
                  Approved Days
                </label>
                <input
                  id="approvedDays"
                  name="approvedDays"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={approvedDaysVal}
                  onChange={(e) => setApprovedDaysVal(e.target.value)}
                  className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${approvedError
                      ? "border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                      : "border-border focus:border-indigo-500"
                    }`}
                />
                {approvedError ? (
                  <FieldError message={approvedError} />
                ) : approvedRangeWarning ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0 mt-px" />
                    <span>{approvedRangeWarning}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="approvedBy" className="text-xs font-semibold text-foreground">
                Sanctioned By (Office / Officer)
              </label>
              <input
                id="approvedBy"
                name="approvedBy"
                type="text"
                required={hasSanction}
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="e.g. S.P. Office / Dy.S.P."
                className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:outline-hidden ${byError
                    ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    : "border-border focus:border-indigo-500"
                  }`}
              />
              {byError && <FieldError message={byError} />}
            </div>

            {/* The range is entered above, but it is the sanction's own
                validity window -- without it repeated here it was out of
                sight at exactly the moment the order is being recorded.
                Read-only on purpose: a second input with the same name would
                submit the field twice. */}
            <div className="rounded-xl border border-border bg-card/60 p-2.5 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-indigo-500 shrink-0" />
                  <span>Sanction date range</span>
                </span>
                {validFrom || validTo ? (
                  <span className="font-semibold text-foreground text-right">
                    {validFrom || "…"} to {validTo || "onwards"}
                    {rangeDays !== null && ` (${rangeDays} day${rangeDays === 1 ? "" : "s"})`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {validFrom || validTo
                  ? "Taken from the date range above. Edit it there to change it."
                  : "No window set above, so this sanction may be logged on any date until it expires."}
              </p>
            </div>

            {/* 6-Month Expiration Notice */}
            {sanctionExpiryPreview && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="size-3.5 text-amber-500 shrink-0" />
                  <span>6-Month Validity Rule</span>
                </div>
                <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                  This sanction will automatically expire on <strong>{sanctionExpiryPreview}</strong>. Any unlogged days after 6 months will lapse and expire.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="orderNo" className="text-xs font-semibold text-foreground">
                Order / Dispatch Number (Optional)
              </label>
              <input
                id="orderNo"
                name="orderNo"
                type="text"
                placeholder="e.g. DSP/LEAVE/2026/102"
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            pending ||
            Boolean(appliedError) ||
            Boolean(dateRangeError) ||
            (hasSanction && Boolean(approvedError))
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <span>{hasSanction ? "Record Approved Sanction" : "Submit Application"}</span>
        </button>
      </div>
    </form>
  );
}
