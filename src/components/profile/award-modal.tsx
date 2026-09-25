"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  X,
  Trophy,
  Award,
  Calendar,
  Building2,
  BadgeCheck,
  FileText,
  Loader2,
  Sparkles,
  MapPin,
  Check,
  Medal,
  Crown,
  Star,
  Flame,
  Target,
  IndianRupee,
  ScrollText,
  FileCheck,
  ShieldCheck,
  Flag,
  Users,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import {
  createTimelineEventAction,
  updateTimelineEventAction,
} from "@/actions/profile";
import type { TimelineEventItem } from "./timeline-event-modal";

interface AwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: TimelineEventItem | null;
  onSuccess?: () => void;
}

export const AWARD_SUGGESTIONS = [
  "Good Service Ticket (GST)",
  "GST with Cash Reward",
  "Good Service Entry (GSE)",
  "Cash Reward from SP / CP",
  "Superintendent of Police (SP) Commendation Roll",
  "Commissioner of Police (CP) Commendation Roll",
  "Range IG / DIG Commendation",
  "Director General of Police (DGP) Commendation Disc & Roll",
  "Chief Minister's Police Medal",
  "President's Police Medal for Distinguished Service (PPM)",
  "Police Medal for Meritorious Service (PMMS)",
  "President's Police Medal for Gallantry (PPMG)",
  "Police Medal for Gallantry (PMG)",
  "Union Home Minister's Medal for Excellence in Investigation",
  "Antarik Suraksha Seva Medal",
  "26th Jan Republic Day Best Performance Medal",
  "26th Jan Republic Day Parade Commander / Contingent Trophy",
  "15th Aug Independence Day Commendation & Medal",
  "15th Aug Independence Day Best Performance Award",
  "31st Oct Rashtriya Ekta Diwas Medal / Kevadia Parade Honour",
  "31st Oct National Unity Day Best Contingent Award",
  "Best Parade Commander / Guard of Honour Award",
  "Ceremonial Parade Best March-Past Trophy",
  "Annual Best Performance Award (શ્રેષ્ઠ કામગીરી)",
  "1st May Gujarat Day (ગુજરાત ગૌરવ દિન) Honour",
  "Special Bandobast / Operation Commendation",
  "Best Police Sub-Inspector / IO Award",
  "Best Police Station Trophy",
  "Certificate of Merit",
  "Appreciation Letter (કદર પત્ર)",
  "All India Police Games / Shooting Medal",
];

export const AWARD_CATEGORIES = [
  { id: "Good Service Ticket (GST)", label: "Good Service Ticket (GST)", icon: BadgeCheck },
  { id: "GST with Cash Reward", label: "GST with Cash Reward", icon: IndianRupee },
  { id: "Good Service Entry (GSE)", label: "Good Service Entry (GSE)", icon: FileCheck },
  { id: "Cash Reward", label: "Cash Reward (રોકડ ઇનામ)", icon: IndianRupee },
  { id: "SP / CP Commendation Roll", label: "SP / CP Commendation Roll", icon: ScrollText },
  { id: "Range IG / DIG Commendation", label: "Range IG / DIG Commendation", icon: Award },
  { id: "DGP Commendation Disc", label: "DGP Commendation Disc & Roll", icon: Medal },
  { id: "Chief Minister's Police Medal", label: "Chief Minister's Police Medal", icon: Star },
  { id: "President's Police Medal (PPM)", label: "President's Police Medal (PPM)", icon: Crown },
  { id: "Police Medal for Meritorious Service", label: "Meritorious Service Medal", icon: Award },
  { id: "Police Medal for Gallantry (PMG)", label: "Gallantry Medal (PMG / PPMG)", icon: Flame },
  { id: "Home Minister's Investigation Medal", label: "Excellence in Investigation", icon: BadgeCheck },
  { id: "26 January (Republic Day) Award", label: "26 Jan Republic Day Award / Medal", icon: Flag },
  { id: "15 August (Independence Day) Award", label: "15 Aug Independence Day Award / Medal", icon: Flag },
  { id: "31 October (Rashtriya Ekta Diwas)", label: "31 Oct Ekta Diwas Parade / Award", icon: Users },
  { id: "Parade & Ceremonial Best Performance", label: "Parade & March-Past Trophy", icon: Trophy },
  { id: "Best Annual / Operational Performance", label: "Best Performance Award / Medal", icon: Star },
  { id: "Special Duty / Bandobast Honour", label: "Special Bandobast / Op Honour", icon: ShieldCheck },
  { id: "Best Officer / Station Trophy", label: "Best Officer / Station Trophy", icon: Trophy },
  { id: "Appreciation Letter (Kadar Patra)", label: "Appreciation (કદર પત્ર)", icon: FileText },
  { id: "Certificate of Merit", label: "Certificate of Merit", icon: FileText },
  { id: "Sports & Shooting Championship", label: "Sports & Shooting Medal", icon: Target },
];

function getInitialValues(eventToEdit?: TimelineEventItem | null) {
  if (eventToEdit) {
    const rawDesc = eventToEdit.description || "";
    let ticketNo = "";
    let citation = rawDesc;
    if (rawDesc.startsWith("GST/Ticket: ")) {
      const lines = rawDesc.split("\n");
      ticketNo = lines[0].replace("GST/Ticket: ", "");
      citation = lines.slice(1).join("\n");
    }

    const matchedCat = AWARD_CATEGORIES.find(
      (c) =>
        eventToEdit.title.toLowerCase().includes(c.label.toLowerCase()) ||
        eventToEdit.title.toLowerCase().includes(c.id.toLowerCase()) ||
        (eventToEdit.title.toLowerCase().includes("gst") && c.id.includes("GST")) ||
        (eventToEdit.title.toLowerCase().includes("gse") && c.id.includes("GSE")) ||
        (eventToEdit.title.toLowerCase().includes("cash") && c.id.includes("Cash")) ||
        (eventToEdit.title.toLowerCase().includes("dgp") && c.id.includes("DGP")) ||
        (eventToEdit.title.toLowerCase().includes("president") && c.id.includes("President")) ||
        (eventToEdit.title.toLowerCase().includes("gallantry") && c.id.includes("Gallantry")) ||
        (eventToEdit.title.toLowerCase().includes("investigation") && c.id.includes("Investigation")) ||
        ((eventToEdit.title.toLowerCase().includes("26 jan") || eventToEdit.title.toLowerCase().includes("republic")) && c.id.includes("26 January")) ||
        ((eventToEdit.title.toLowerCase().includes("15 aug") || eventToEdit.title.toLowerCase().includes("independence")) && c.id.includes("15 August")) ||
        ((eventToEdit.title.toLowerCase().includes("ekta") || eventToEdit.title.toLowerCase().includes("31 oct") || eventToEdit.title.toLowerCase().includes("unity")) && c.id.includes("Ekta")) ||
        ((eventToEdit.title.toLowerCase().includes("parade") || eventToEdit.title.toLowerCase().includes("march") || eventToEdit.title.toLowerCase().includes("drill")) && c.id.includes("Parade")) ||
        (eventToEdit.title.toLowerCase().includes("best performance") && c.id.includes("Best Performance"))
    );

    return {
      title: eventToEdit.title,
      awardCategory: matchedCat ? matchedCat.id : "Good Service Ticket (GST)",
      awardDate: eventToEdit.start_date || "",
      ticketNo,
      issuingAuthority: eventToEdit.department || "",
      designation: eventToEdit.designation || "",
      stationUnit: eventToEdit.location || "",
      citation,
    };
  }

  return {
    title: "",
    awardCategory: "Good Service Ticket (GST)",
    awardDate: new Date().toISOString().split("T")[0],
    ticketNo: "",
    issuingAuthority: "",
    designation: "",
    stationUnit: "",
    citation: "",
  };
}

export function AwardModal(props: AwardModalProps) {
  useBodyScrollLock(props.isOpen);

  if (!props.isOpen) return null;

  return <AwardModalContent key={props.eventToEdit?.id ?? "new"} {...props} />;
}

function AwardModalContent({
  onClose,
  eventToEdit,
  onSuccess,
}: Omit<AwardModalProps, "isOpen">) {
  const initial = useMemo(() => getInitialValues(eventToEdit), [eventToEdit]);

  const [title, setTitle] = useState(initial.title);
  const [awardCategory, setAwardCategory] = useState(initial.awardCategory);
  const [awardDate, setAwardDate] = useState(initial.awardDate);
  const [ticketNo, setTicketNo] = useState(initial.ticketNo);
  const [issuingAuthority, setIssuingAuthority] = useState(initial.issuingAuthority);
  const [designation, setDesignation] = useState(initial.designation);
  const [stationUnit, setStationUnit] = useState(initial.stationUnit);
  const [citation, setCitation] = useState(initial.citation);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-dismiss error message after 4 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg("Please enter the name of the honour or award.");
      return;
    }

    if (!awardDate) {
      setErrorMsg("Please select the date the award was presented.");
      return;
    }

    let finalDesc = citation.trim();
    if (ticketNo.trim()) {
      finalDesc = finalDesc
        ? `GST/Ticket No: ${ticketNo.trim()}\n${finalDesc}`
        : `GST/Ticket No: ${ticketNo.trim()}`;
    }

    const formData = new FormData();
    formData.append("eventType", eventToEdit?.event_type === "PROMOTION" ? "PROMOTION" : "ACHIEVEMENT");
    formData.append("title", trimmedTitle);
    formData.append("startDate", awardDate);
    formData.append("endDate", "");
    formData.append("isCurrent", "false");
    formData.append("department", issuingAuthority.trim());
    formData.append("designation", designation.trim());
    formData.append("location", stationUnit.trim());
    formData.append("description", finalDesc);

    startTransition(async () => {
      try {
        const res = eventToEdit
          ? await updateTimelineEventAction(eventToEdit.id, undefined, formData)
          : await createTimelineEventAction(undefined, formData);

        if (res?.ok) {
          onSuccess?.();
          onClose();
        } else {
          setErrorMsg(res?.message || "Failed to save honour. Please check the details.");
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  return (
    <ModalPortal>
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPending) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in-0 duration-150`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 shrink-0 bg-amber-500/5 dark:bg-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-xs">
                <Trophy className="size-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>{eventToEdit ? "Edit Honour / Award" : "Add Honour / Award"}</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Official Record
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Record medals, DGP commendation rolls, citations, and awards.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Form */}
          <form
            id="award-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 space-y-4.5 overscroll-contain"
          >
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Quick Suggestions */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Common Police Honours (Tap to select)</span>
                </span>
                <span className="text-[10px] text-muted-foreground lowercase">tap to fill</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1 p-0.5">
                {AWARD_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setTitle(suggestion);
                      const matched = AWARD_CATEGORIES.find(
                        (c) =>
                          suggestion.toLowerCase().includes(c.label.toLowerCase()) ||
                          suggestion.toLowerCase().includes(c.id.toLowerCase()) ||
                          (suggestion.includes("GST") && c.id.includes("GST")) ||
                          (suggestion.includes("GSE") && c.id.includes("GSE")) ||
                          (suggestion.includes("Cash") && c.id.includes("Cash")) ||
                          (suggestion.includes("DGP") && c.id.includes("DGP")) ||
                          (suggestion.includes("President") && c.id.includes("President")) ||
                          (suggestion.includes("Gallantry") && c.id.includes("Gallantry")) ||
                          (suggestion.includes("CM") && c.id.includes("CM")) ||
                          (suggestion.includes("Investigation") && c.id.includes("Investigation")) ||
                          ((suggestion.includes("26th Jan") || suggestion.includes("Republic")) && c.id.includes("26 January")) ||
                          ((suggestion.includes("15th Aug") || suggestion.includes("Independence")) && c.id.includes("15 August")) ||
                          ((suggestion.includes("31st Oct") || suggestion.includes("Ekta") || suggestion.includes("Unity")) && c.id.includes("Ekta")) ||
                          ((suggestion.includes("Parade") || suggestion.includes("March")) && c.id.includes("Parade")) ||
                          (suggestion.includes("Best Performance") && c.id.includes("Best Performance"))
                      );
                      if (matched) setAwardCategory(matched.id);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-muted hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 border border-border/80 transition-colors cursor-pointer"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Award Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Honour / Award Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Trophy className="absolute left-3.5 top-3 size-4 text-amber-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Good Service Ticket (GST) or DGP Commendation Disc"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>Award Category</span>
                <span className="text-[10px] text-muted-foreground">{AWARD_CATEGORIES.length} Categories</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1 p-0.5">
                {AWARD_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = awardCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setAwardCategory(cat.id);
                        if (!title || AWARD_CATEGORIES.some((c) => c.label === title || c.id === title)) {
                          setTitle(cat.id);
                        }
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500 shadow-xs"
                          : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0 text-amber-500" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Awarded & Rank */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Date Awarded / Presented <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={awardDate}
                    onChange={(e) => setAwardDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Rank / Designation When Awarded
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Police Inspector, PSI, HC"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Issuing Authority & Station/Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Issuing Authority / Presenter
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="e.g. CP Ahmedabad / DGP Gujarat / SP"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Station / Division / District
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={stationUnit}
                    onChange={(e) => setStationUnit(e.target.value)}
                    placeholder="e.g. Crime Branch, Ahmedabad"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* GST / Ticket Number or Cash Reward */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span>GST / Ticket No. or Cash Reward Amount</span>
                <span className="text-[11px] text-muted-foreground font-normal">Optional</span>
              </label>
              <div className="relative">
                <BadgeCheck className="absolute left-3.5 top-3 size-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
                <input
                  type="text"
                  value={ticketNo}
                  onChange={(e) => setTicketNo(e.target.value)}
                  placeholder="e.g. GST No. 142/2023 or Cash Reward of ₹2,000"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Citation / Merit Reason */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Citation &amp; Commendation Reason
              </label>
              <textarea
                rows={3}
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="Detail the case, investigation, or exemplary conduct for which this honour was bestowed (e.g. Awarded for solving interstate robbery gang in record 48 hours)..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 leading-relaxed"
              />
            </div>
          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border/80 shrink-0 bg-muted/20">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="award-form"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-bold shadow-md shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving Honour...</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>{eventToEdit ? "Update Honour" : "Save Honour to Record"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
