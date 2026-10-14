"use client";

import { useState, useTransition, useEffect } from "react";
import {
  X,
  Calendar,
  MapPin,
  Building2,
  BadgeCheck,
  Shield,
  GraduationCap,
  ArrowRightLeft,
  Award,
  Flame,
  Trophy,
  Bookmark,
  Loader2,
  FileText,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import type { OfficerTimelineEventType } from "@/types/database";
import {
  createTimelineEventAction,
  updateTimelineEventAction,
} from "@/actions/profile";
import type { FormState } from "@/lib/forms/formState";
import { useLanguage } from "@/lib/i18n/language-context";

export interface TimelineEventItem {
  id: string;
  user_id?: string;
  event_type: OfficerTimelineEventType;
  title: string;
  designation?: string | null;
  department?: string | null;
  location?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
  description?: string | null;
}

interface TimelineEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: TimelineEventItem | null;
  defaultEventType?: OfficerTimelineEventType;
  onSuccess?: () => void;
}

const EVENT_TYPE_OPTIONS: Array<{
  type: OfficerTimelineEventType;
  label: string;
  gujaratiLabel: string;
  icon: typeof Shield;
  hint: string;
}> = [
  {
    type: "JOINING",
    label: "Joining",
    gujaratiLabel: "સેવા પ્રવેશ",
    icon: Shield,
    hint: "Initial police service appointment & induction",
  },
  {
    type: "TRAINING",
    label: "Training",
    gujaratiLabel: "તાલીમ",
    icon: GraduationCap,
    hint: "Police academy or specialized courses",
  },
  {
    type: "POSTING",
    label: "Posting",
    gujaratiLabel: "પોસ્ટિંગ",
    icon: Building2,
    hint: "Police station, branch or division assignment",
  },
  {
    type: "TRANSFER",
    label: "Transfer",
    gujaratiLabel: "બદલી",
    icon: ArrowRightLeft,
    hint: "Relocation from one station to another",
  },
  {
    type: "PROMOTION",
    label: "Promotion",
    gujaratiLabel: "બઢતી",
    icon: Award,
    hint: "Rank or designation elevation",
  },
  {
    type: "SPECIAL_DUTY",
    label: "Special Duty",
    gujaratiLabel: "વિશેષ ફરજ",
    icon: Flame,
    hint: "Bandobast, election, VIP security or special ops",
  },
  {
    type: "ACHIEVEMENT",
    label: "Award",
    gujaratiLabel: "એવોર્ડ",
    icon: Trophy,
    hint: "Medal, citation, or commendation letter",
  },
  {
    type: "OTHER",
    label: "Other",
    gujaratiLabel: "અન્ય",
    icon: Bookmark,
    hint: "Other career milestone",
  },
];

export function TimelineEventModal({
  isOpen,
  onClose,
  eventToEdit,
  defaultEventType,
  onSuccess,
}: TimelineEventModalProps) {
  const { isGujarati, t } = useLanguage();
  useBodyScrollLock(isOpen);

  const [eventType, setEventType] = useState<OfficerTimelineEventType>(
    defaultEventType || "POSTING"
  );
  const [title, setTitle] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-dismiss error message after 4 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (eventToEdit) {
      setEventType(eventToEdit.event_type);
      setTitle(eventToEdit.title);
      setDesignation(eventToEdit.designation ?? "");
      setDepartment(eventToEdit.department ?? "");
      setLocation(eventToEdit.location ?? "");
      setFromLocation(eventToEdit.from_location ?? "");
      setToLocation(eventToEdit.to_location ?? "");
      setStartDate(eventToEdit.start_date);
      setEndDate(eventToEdit.end_date ?? "");
      setIsCurrent(eventToEdit.is_current);
      setDescription(eventToEdit.description ?? "");
    } else {
      setEventType(defaultEventType || "POSTING");
      setTitle("");
      setDesignation("");
      setDepartment("");
      setLocation("");
      setFromLocation("");
      setToLocation("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setIsCurrent(false);
      setDescription("");
    }
    setErrorMsg(null);
  }, [eventToEdit, isOpen, defaultEventType]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("eventType", eventType);
    formData.append("title", title);
    formData.append("designation", designation);
    formData.append("department", department);
    formData.append("location", location);
    formData.append("fromLocation", fromLocation);
    formData.append("toLocation", toLocation);
    formData.append("startDate", startDate);
    if (!isCurrent && endDate) {
      formData.append("endDate", endDate);
    }
    formData.append("isCurrent", isCurrent ? "true" : "false");
    formData.append("description", description);

    startTransition(async () => {
      let res: FormState;
      if (eventToEdit?.id) {
        res = await updateTimelineEventAction(eventToEdit.id, undefined, formData);
      } else {
        res = await createTimelineEventAction(undefined, formData);
      }

      if (!res?.ok) {
        setErrorMsg(
          res?.message ??
            (res?.errors
              ? Object.values(res.errors).flat().join(", ")
              : "Failed to save milestone.")
        );
      } else {
        onSuccess?.();
        onClose();
      }
    });
  };

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isPending) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in-0 duration-150`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 shrink-0 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Calendar className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {eventToEdit
                    ? isGujarati
                      ? "કારકિર્દી માઇલસ્ટોન સંપાદિત કરો"
                      : "Edit Career Milestone"
                    : isGujarati
                    ? "કારકિર્દી માઇલસ્ટોન ઉમેરો"
                    : "Add Career Milestone"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isGujarati
                    ? "પોસ્ટિંગ્સ, બદલીઓ, એકેડેમી તાલીમ અને સિદ્ધિઓ ટ્રૅક કરો."
                    : "Track postings, transfers, academy training, and achievements."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Form Content */}
          <form
            id="timeline-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 space-y-4.5 overscroll-contain"
          >
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Event Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                {t.profile.milestoneType}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EVENT_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = eventType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        setEventType(opt.type);
                        if (!title) {
                          if (opt.type === "JOINING") setTitle(t.profile.joinedPolice);
                          if (opt.type === "TRAINING") setTitle(t.profile.academyTraining);
                          if (opt.type === "TRANSFER") setTitle(t.profile.transferredStation);
                          if (opt.type === "PROMOTION") setTitle(t.profile.promotedRank);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs ring-1 ring-indigo-500"
                          : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-5 mb-1 shrink-0" />
                      <span className="text-xs">{isGujarati ? opt.gujaratiLabel : opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t.profile.milestoneTitle}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isGujarati
                    ? "દા.ત. સ્ટેશન ઇન્ચાર્જ / ડ્યુટી ઓફિસર"
                    : "e.g. Station In-charge / Duty Officer"
                }
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* If TRANSFER */}
            {eventType === "TRANSFER" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isGujarati
                      ? "ક્યાંથી બદલી (સ્ટેશન / જિલ્લો)"
                      : "Transferred From (Station / District)"}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 size-4 text-cyan-600 dark:text-cyan-400 pointer-events-none" />
                    <input
                      type="text"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      placeholder={
                        isGujarati
                          ? "દા.ત. એલિસબ્રિજ પોલીસ સ્ટેશન"
                          : "e.g. Ellisbridge Police Station"
                      }
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-500 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isGujarati
                      ? "ક્યાં બદલી (સ્ટેશન / જિલ્લો)"
                      : "Transferred To (Station / District)"}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 size-4 text-indigo-600 dark:text-indigo-400 pointer-events-none" />
                    <input
                      type="text"
                      value={toLocation}
                      onChange={(e) => setToLocation(e.target.value)}
                      placeholder={
                        isGujarati
                          ? "દા.ત. નવરંગપુરા પોલીસ સ્ટેશન"
                          : "e.g. Navrangpura Police Station"
                      }
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Department / Station & Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {eventType === "TRAINING"
                    ? isGujarati
                      ? "એકેડેમી / સંસ્થા"
                      : "Academy / Institution"
                    : isGujarati
                    ? "પોલીસ સ્ટેશન / શાખા / વિભાગ"
                    : "Police Station / Branch / Department"}
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={
                      eventType === "TRAINING"
                        ? isGujarati
                          ? "દા.ત. ગુજરાત પોલીસ એકેડેમી, કરાઈ"
                          : "e.g. Gujarat Police Academy, Karai"
                        : isGujarati
                        ? "દા.ત. નવરંગપુરા પોલીસ સ્ટેશન"
                        : "e.g. Navrangpura Police Station"
                    }
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t.profile.designationRankAtTime}
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder={
                      isGujarati
                        ? "દા.ત. પોલીસ ઇન્સ્પેક્ટર, પીએસઆઈ, હે.કો."
                        : "e.g. Police Inspector, PSI, HC"
                    }
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Location (non-transfers) */}
            {eventType !== "TRANSFER" && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t.profile.locationCityDistrict}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      isGujarati
                        ? "દા.ત. અમદાવાદ શહેર / ગાંધીનગર / સુરત"
                        : "e.g. Ahmedabad City / Gandhinagar / Surat"
                    }
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {eventType === "JOINING"
                    ? isGujarati
                      ? "પ્રવેશ તારીખ"
                      : "Joining Date"
                    : eventType === "TRANSFER"
                    ? isGujarati
                      ? "બદલી / હુકમ તારીખ"
                      : "Transfer / Order Date"
                    : isGujarati
                    ? "શરૂઆત તારીખ"
                    : "Start Date"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {t.profile.endCompletionDate}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCurrent}
                      onChange={(e) => {
                        setIsCurrent(e.target.checked);
                        if (e.target.checked) setEndDate("");
                      }}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500 size-3.5"
                    />
                    <span>{t.profile.currentlyActive}</span>
                  </label>
                </div>
                <input
                  type="date"
                  disabled={isCurrent}
                  value={isCurrent ? "" : endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {isGujarati
                  ? "વિગતો / ઓર્ડર નંબર / જવાબદારીઓ"
                  : "Details / Order Number / Responsibilities"}
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isGujarati
                      ? "દા.ત. ઓર્ડર નં. GP/EST/2022/941. કાયદો અને વ્યવસ્થા ઇન્ચાર્જ."
                      : "e.g. Order No. GP/EST/2022/941. In-charge of Law & Order."
                  }
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border/80 bg-muted/20 shrink-0">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {t.common.cancel}
            </button>

            <button
              type="submit"
              form="timeline-form"
              disabled={isPending}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t.common.saving}</span>
                </>
              ) : (
                <span>
                  {eventToEdit
                    ? t.profile.editMilestone
                    : t.profile.addMilestone}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
