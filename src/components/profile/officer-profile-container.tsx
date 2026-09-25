"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import {
  Clock,
  Building2,
  Calendar,
  MapPin,
  Award,
  FileText,
  BadgeCheck,
  Check,
  Loader2,
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Flame,
  Medal,
  IndianRupee,
  Flag,
  Users,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { OfficerTimeline } from "./officer-timeline";
import type { DepartmentOption } from "./department-combobox";
import { AwardModal } from "./award-modal";
import { OfficerAvatarEditor } from "./officer-avatar-editor";
import type { TimelineEventItem } from "./timeline-event-modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { updateOfficerProfileDetails, deleteTimelineEventAction } from "@/actions/profile";
import { formatTimelineDate } from "@/lib/profile/timelineUtils";
import type { FormState } from "@/lib/forms/formState";

export interface OfficerProfileData {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  designation?: string | null;
  employeeCode?: string | null;
  joiningDate?: string | null;
  joiningPlace?: string | null;
  currentPosting?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: string | null;
  homeDistrict?: string | null;
  bio?: string | null;
  role?: string;
  status?: string;
}

interface OfficerProfileContainerProps {
  officer: OfficerProfileData;
  departments?: DepartmentOption[];
  timelineEvents: TimelineEventItem[];
  canEdit?: boolean;
}

type TabKey = "timeline" | "achievements";

export function OfficerProfileContainer({
  officer,
  timelineEvents,
  canEdit = true,
}: OfficerProfileContainerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("timeline");
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateOfficerProfileDetails,
    undefined
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Profile updated successfully.", "success", 4000);
    } else if (state.message) {
      toast(state.message, "error", 4000);
    }
  }, [state, toast]);

  const [isHonourModalOpen, setIsHonourModalOpen] = useState(false);
  const [honourToEdit, setHonourToEdit] = useState<TimelineEventItem | null>(null);
  const [honourToDelete, setHonourToDelete] = useState<TimelineEventItem | null>(null);
  const [isDeletingHonour, startDeleteHonourTransition] = useTransition();

  const honours = timelineEvents.filter(
    (e) => e.event_type === "ACHIEVEMENT" || e.event_type === "PROMOTION"
  );

  const handleDeleteHonourConfirm = () => {
    if (!honourToDelete) return;
    startDeleteHonourTransition(async () => {
      await deleteTimelineEventAction(honourToDelete.id);
      setHonourToDelete(null);
    });
  };

  const serviceYears = (() => {
    if (!officer.joiningDate) return null;
    const start = new Date(officer.joiningDate);
    const now = new Date();
    if (isNaN(start.getTime()) || start > now) return null;
    const diffYears = now.getFullYear() - start.getFullYear();
    const diffMonths = now.getMonth() - start.getMonth();
    const totalMonths = diffYears * 12 + diffMonths;
    if (totalMonths < 12) return `${totalMonths} mos service`;
    const yrs = Math.floor(totalMonths / 12);
    const mos = totalMonths % 12;
    return `${yrs} yr${yrs > 1 ? "s" : ""}${mos > 0 ? ` ${mos} mo${mos > 1 ? "s" : ""}` : ""} service`;
  })();

  return (
    <div className="space-y-6">
      {/* Top Officer Header Card */}
      <Card className="relative overflow-hidden p-5 sm:p-7 border-border bg-card">
        <div className="absolute -top-16 -right-16 size-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 size-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <OfficerAvatarEditor
              fullName={officer.fullName}
              avatarUrl={officer.avatarUrl}
              designation={officer.designation}
              canEdit={canEdit}
            />

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {officer.fullName}
                </h2>
                {officer.role && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                    {officer.role.replace("_", " ")}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground font-medium">
                {officer.designation ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {officer.designation}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Rank not specified</span>
                )}

                {officer.employeeCode && (
                  <>
                    <span className="text-border">•</span>
                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded-md text-foreground">
                      <BadgeCheck className="size-3 text-amber-500" />
                      Buckle #{officer.employeeCode}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                {(officer.currentPosting || officer.departmentName) && (
                  <div className="flex items-center gap-1 text-foreground">
                    <Building2 className="size-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {officer.currentPosting || officer.departmentName}
                    </span>
                  </div>
                )}

                {serviceYears && (
                  <>
                    <span className="text-border">•</span>
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Clock className="size-3.5 shrink-0" />
                      <span>{serviceYears}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-6 shrink-0 justify-around sm:justify-start">
            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className="text-center px-2.5 py-1.5 rounded-xl hover:bg-muted/80 transition-all cursor-pointer group"
              title="View Career Timeline"
            >
              <span className="block text-xl font-bold text-foreground group-hover:scale-105 transition-transform">
                {timelineEvents.length}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Milestones
              </span>
            </button>
            <div className="h-8 w-px bg-border" />
            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className="text-center px-2.5 py-1.5 rounded-xl hover:bg-muted/80 transition-all cursor-pointer group"
              title="View Postings in Timeline"
            >
              <span className="block text-xl font-bold text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                {
                  timelineEvents.filter(
                    (e) => e.event_type === "POSTING" || e.event_type === "TRANSFER"
                  ).length
                }
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Postings
              </span>
            </button>
            <div className="h-8 w-px bg-border" />
            <button
              type="button"
              onClick={() => setActiveTab("achievements")}
              className="text-center px-2.5 py-1.5 rounded-xl hover:bg-amber-500/10 transition-all cursor-pointer group"
              title="View Honours & Awards"
            >
              <span className="block text-xl font-bold text-amber-500 group-hover:scale-110 transition-transform">
                {honours.length}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400">
                Honours
              </span>
            </button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/80 no-scrollbar">
        {[
          { id: "timeline", label: "Career Timeline", icon: Clock },
          { id: "achievements", label: "Honours & Awards", icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === "timeline" && (
        <Card className="p-4 sm:p-6 border-border bg-card">
          <OfficerTimeline events={timelineEvents} canEdit={canEdit} />
        </Card>
      )}

      {/* Tab 2: Honours, Awards & Bio */}
      {activeTab === "achievements" && (
        <form action={formAction} className="space-y-6">
          {/* Hidden inputs to preserve profile fields managed in Settings */}
          <input
            type="hidden"
            name="fullName"
            defaultValue={officer.fullName ?? ""}
          />
          <input
            type="hidden"
            name="phone"
            defaultValue={officer.phone ?? ""}
          />
          <input
            type="hidden"
            name="dateOfBirth"
            defaultValue={officer.dateOfBirth ?? ""}
          />
          <input
            type="hidden"
            name="bloodGroup"
            defaultValue={officer.bloodGroup ?? ""}
          />
          <input
            type="hidden"
            name="emergencyContact"
            defaultValue={officer.emergencyContact ?? ""}
          />
          <input
            type="hidden"
            name="homeDistrict"
            defaultValue={officer.homeDistrict ?? ""}
          />
          <input
            type="hidden"
            name="departmentId"
            defaultValue={officer.departmentId ?? ""}
          />
          <input
            type="hidden"
            name="designation"
            defaultValue={officer.designation ?? ""}
          />
          <input
            type="hidden"
            name="employeeCode"
            defaultValue={officer.employeeCode ?? ""}
          />
          <input
            type="hidden"
            name="joiningDate"
            defaultValue={officer.joiningDate ?? ""}
          />
          <input
            type="hidden"
            name="joiningPlace"
            defaultValue={officer.joiningPlace ?? ""}
          />
          <input
            type="hidden"
            name="currentPosting"
            defaultValue={officer.currentPosting ?? ""}
          />
            <div className="space-y-6">
              {/* Section 1: Official Honours & Medals List */}
              <Card className="p-5 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                      <Trophy className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                          Honours &amp; Commendations
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30">
                          {honours.length}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Official medals, commendation discs, President&apos;s awards, and career citations.
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setHonourToEdit(null);
                        setIsHonourModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-bold shadow-xs shadow-amber-500/25 transition-all active:scale-[0.98] cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="size-4" />
                      <span>Add Honour / Award</span>
                    </button>
                  )}
                </div>

                {/* Honours List */}
                {honours.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {honours.map((honour) => (
                      <div
                        key={honour.id}
                        className="relative flex flex-col justify-between p-4 rounded-2xl bg-card border border-amber-500/25 dark:border-amber-500/30 hover:border-amber-500/50 transition-all shadow-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              {(() => {
                                const t = honour.title.toLowerCase();
                                const isGst = t.includes("gst") || t.includes("good service ticket");
                                const isGse = t.includes("gse") || t.includes("good service entry");
                                const isCash = t.includes("cash");
                                const isGallantry = t.includes("gallantry") || t.includes("pmg");
                                const isDgp = t.includes("dgp");
                                const isPresident = t.includes("president");
                                const isCm = t.includes("chief minister") || t.includes("cm");
                                const is26Jan = t.includes("26 jan") || t.includes("republic");
                                const is15Aug = t.includes("15 aug") || t.includes("independence");
                                const isEkta = t.includes("ekta") || t.includes("31 oct") || t.includes("unity");
                                const isParade = t.includes("parade") || t.includes("march") || t.includes("drill");
                                const isBestPerf = t.includes("best performance") || t.includes("shrestha");

                                return (
                                  <>
                                    <div
                                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                        isGst
                                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                          : isGse
                                          ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30"
                                          : isGallantry
                                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                          : isCash
                                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                          : isDgp
                                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                          : isPresident || isCm
                                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/35"
                                          : is26Jan
                                          ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                                          : is15Aug
                                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                          : isEkta
                                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                          : isParade
                                          ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                                          : isBestPerf
                                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                          : honour.event_type === "PROMOTION"
                                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                      }`}
                                    >
                                      {isGst ? (
                                        <BadgeCheck className="size-4" />
                                      ) : isGse ? (
                                        <FileText className="size-4" />
                                      ) : isGallantry ? (
                                        <Flame className="size-4" />
                                      ) : isCash ? (
                                        <IndianRupee className="size-4" />
                                      ) : is26Jan || is15Aug ? (
                                        <Flag className="size-4" />
                                      ) : isEkta ? (
                                        <Users className="size-4" />
                                      ) : isBestPerf ? (
                                        <Star className="size-4" />
                                      ) : isDgp || isPresident || isCm ? (
                                        <Medal className="size-4" />
                                      ) : honour.event_type === "PROMOTION" ? (
                                        <Award className="size-4" />
                                      ) : (
                                        <Trophy className="size-4" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-sm font-bold text-foreground leading-snug truncate">
                                          {honour.title}
                                        </h4>
                                        {isGst && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                            GST
                                          </span>
                                        )}
                                        {isGse && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-bold border border-teal-500/30">
                                            GSE
                                          </span>
                                        )}
                                        {isGallantry && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-500/30">
                                            Gallantry
                                          </span>
                                        )}
                                        {isCash && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                            Cash Reward
                                          </span>
                                        )}
                                        {isDgp && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-500/30">
                                            DGP Disc
                                          </span>
                                        )}
                                        {isPresident && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-bold border border-amber-500/40">
                                            President Medal
                                          </span>
                                        )}
                                        {is26Jan && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[10px] font-bold border border-orange-500/30">
                                            26 Jan / Republic Day
                                          </span>
                                        )}
                                        {is15Aug && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                            15 Aug / Independence
                                          </span>
                                        )}
                                        {isEkta && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                                            31 Oct / Ekta Diwas
                                          </span>
                                        )}
                                        {isParade && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                                            Parade & Drill
                                          </span>
                                        )}
                                        {isBestPerf && !is26Jan && !is15Aug && (
                                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                            Best Performance
                                          </span>
                                        )}
                                      </div>
                                      {honour.designation && (
                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                          {honour.designation}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            {canEdit && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHonourToEdit(honour);
                                    setIsHonourModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                  title="Edit Honour"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHonourToDelete(honour)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete Honour"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                            {honour.start_date && (
                              <div className="flex items-center gap-1 text-foreground/80">
                                <Calendar className="size-3 text-amber-500" />
                                <span>{formatTimelineDate(honour.start_date, true)}</span>
                              </div>
                            )}
                            {(honour.location || honour.department) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="size-3" />
                                <span className="truncate max-w-[180px]">
                                  {honour.location || honour.department}
                                </span>
                              </div>
                            )}
                          </div>

                          {honour.description && (
                            <p className="text-xs text-muted-foreground/90 bg-muted/50 rounded-xl p-2.5 mt-1 border border-border/50 italic leading-relaxed">
                              &ldquo;{honour.description}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
                    <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Trophy className="size-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      No Official Honours Recorded Yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Click the &ldquo;Add Honour / Award&rdquo; button above to record your medals, DGP commendation rolls, or meritorious service awards. Each honour recorded will automatically increment your official Honours badge.
                    </p>
                  </div>
                )}
              </Card>

              {/* Section 2: Executive Bio & Career Summary (Form Field) */}
              <Card className="p-5 sm:p-8 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-border/80">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Service Bio &amp; Summary Notes
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Freeform executive summary, career highlights, and general service remarks.
                    </p>
                  </div>
                </div>

                <div>
                  <textarea
                    name="bio"
                    rows={5}
                    key={`bio-${officer.bio}`}
                    defaultValue={officer.bio ?? ""}
                    placeholder="Record your career overview, notable cases, or summary:&#10;• Served across Ahmedabad and Surat city units&#10;• Specialized in cyber crime and forensic investigation&#10;• Commended for flood relief operation"
                    className="w-full rounded-xl border border-border bg-background p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Tip: Use this text area for general remarks and notes. Specific awards and medals should be added using &ldquo;Add Honour / Award&rdquo; above.
                  </p>
                </div>
              </Card>
            </div>

          {/* Submit Action Bar */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Dedicated Award Modal for adding/editing honours & awards */}
      <AwardModal
        isOpen={isHonourModalOpen}
        onClose={() => {
          setIsHonourModalOpen(false);
          setHonourToEdit(null);
        }}
        eventToEdit={honourToEdit}
      />

      {/* Modal for confirming honour deletion */}
      <ConfirmDeleteModal
        isOpen={!!honourToDelete}
        onClose={() => setHonourToDelete(null)}
        onConfirm={handleDeleteHonourConfirm}
        isPending={isDeletingHonour}
        title="Delete Honour / Award"
        description={`Are you sure you want to delete "${honourToDelete?.title}" from your official honours?`}
        confirmLabel="Delete Record"
      />
    </div>
  );
}
