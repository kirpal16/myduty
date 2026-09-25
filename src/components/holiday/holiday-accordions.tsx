"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Sparkles,
  Calendar,
  ChevronDown,
  Info,
  Search,
  Briefcase,
  Palmtree,
  CheckCircle2,
  HelpCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DeleteHolidayButton } from "./delete-holiday-button";

export interface HolidayItem {
  id: string;
  name: string;
  holiday_date: string;
  is_government?: boolean | null;
  is_recurring_yearly?: boolean | null;
}

export function HolidayAccordions({
  govtHolidays,
  personalMilestones,
}: {
  govtHolidays: HolidayItem[];
  personalMilestones: HolidayItem[];
}) {
  // Accordion open states (default closed)
  const [openGovt, setOpenGovt] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [openPolicy, setOpenPolicy] = useState(false);

  // Search filter for govt holidays
  const [govtSearch, setGovtSearch] = useState("");

  const filteredGovtHolidays = govtHolidays.filter((h) =>
    h.name.toLowerCase().includes(govtSearch.toLowerCase()) ||
    h.holiday_date.includes(govtSearch)
  );

  return (
    <div className="space-y-4">
      {/* 1. Official Gujarat Government Gazetted Holidays Accordion */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all duration-200">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setOpenGovt((prev) => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0 border border-emerald-500/20">
              <Landmark className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Official Gujarat Government Gazetted Holidays
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ગુજરાત સરકાર જાહેર રજાઓ
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Official non-working state holidays. Not counted against personal leave balance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant="success" className="hidden sm:inline-flex">
              {govtHolidays.length} Holidays
            </Badge>
            <div
              className={`flex size-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-transform duration-300 ${
                openGovt ? "rotate-180 text-foreground bg-muted" : ""
              }`}
            >
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {/* Accordion Content */}
        {openGovt && (
          <div className="border-t border-border/80 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
            {/* Search Filter Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search gazetted holidays (e.g. Uttarayan, Diwali)..."
                  value={govtSearch}
                  onChange={(e) => setGovtSearch(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/30 py-2 pl-9 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-hidden focus:bg-card transition-all"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Showing <strong>{filteredGovtHolidays.length}</strong> of {govtHolidays.length}</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 sm:px-5">Gazetted Holiday Name</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {filteredGovtHolidays.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>{h.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-slate-400" />
                          <span>{h.holiday_date}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                        <DeleteHolidayButton id={h.id} redirectPath="/holidays/mine" />
                      </td>
                    </tr>
                  ))}

                  {filteredGovtHolidays.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-muted-foreground"
                      >
                        <p className="text-xs">
                          {govtSearch
                            ? "No gazetted holidays match your search."
                            : "No Gujarat Government holidays synced yet."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. Personal Milestones & Observances Accordion */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all duration-200">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setOpenPersonal((prev) => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0 border border-purple-500/20">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Private Personal Milestones & Observances
                </h3>
                <span className="text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                  અંગત રજાઓ અને પ્રસંગો
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Anniversaries and personal custom events visible only to you.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant="purple" className="hidden sm:inline-flex">
              {personalMilestones.length} Events
            </Badge>
            <div
              className={`flex size-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-transform duration-300 ${
                openPersonal ? "rotate-180 text-foreground bg-muted" : ""
              }`}
            >
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {/* Accordion Content */}
        {openPersonal && (
          <div className="border-t border-border/80 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 sm:px-5">Personal Event Name</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {personalMilestones.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                          <span>{h.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-slate-400" />
                          <span>{h.holiday_date}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                        <DeleteHolidayButton id={h.id} redirectPath="/holidays/mine" />
                      </td>
                    </tr>
                  ))}

                  {personalMilestones.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-muted-foreground"
                      >
                        <p className="text-xs">
                          No private milestones registered yet. Add one using the form on the right.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. Official Policy & Compensation Guide Accordion */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all duration-200">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setOpenPolicy((prev) => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 border border-indigo-500/20">
              <HelpCircle className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Holiday Rules & Duty Compensation Guidelines
                </h3>
                <span className="text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  નિયમો અને માર્ગદર્શિકા
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Understand gazetted holiday entitlements, holiday working extra pay, and leave rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`flex size-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-transform duration-300 ${
                openPolicy ? "rotate-180 text-foreground bg-muted" : ""
              }`}
            >
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {/* Accordion Content */}
        {openPolicy && (
          <div className="border-t border-border/80 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Landmark className="size-4 shrink-0" />
                  <span>Govt Gazetted Holiday (જાહેર રજા)</span>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  Official Public Holiday (Zero Quota Deduction)
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  These are official public holidays declared by the Government of Gujarat. They do <strong>NOT</strong> deduct from your Casual Leave (CL) or Earned Leave (EL) quota.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Briefcase className="size-4 shrink-0 text-amber-500" />
                  <span>Working Duty on Holiday (ફરજ બજાવી)</span>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  Earns Holiday Extra Pay in Salary (વધારાનું ભથ્થું)
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  If deployed on active duty on a Sunday, 2nd/4th Saturday, or Gazetted Holiday, log it in <strong>Duty Log</strong> and claim <strong>Holiday Duty Extra Pay</strong> to add it to your monthly compensation.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <Palmtree className="size-4 shrink-0 text-indigo-500" />
                  <span>Holiday Leave / Off (રજા ભોગવી)</span>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  Standard Paid Off-Day (No Extra Pay)
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  If you are off duty on a gazetted holiday, you enjoy your official holiday as normal. No duty log or extra pay applies.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
