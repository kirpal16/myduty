"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/format/currency";
import { useHasHover } from "@/lib/hooks/useHasHover";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  seriesColor,
  CHART_CHROME,
  WORKING_COLOR,
  HOLIDAY_COLOR,
} from "./chart-palette";

export type NamedValue = { name: string; value: number; color?: string | null };

function ChartCard({
  title,
  subtitle,
  children,
  isEmpty,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyText?: string;
}) {
  return (
    /* The tap-focus ring and tap highlight are suppressed in globals.css,
       targeting Recharts' own class names — the Tailwind arbitrary variant
       for it compiled to nothing. */
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="h-56 w-full">
        {isEmpty ? (
          <p className="flex h-full min-h-40 items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {emptyText ?? "Nothing recorded for this period yet."}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Recharts opens a tooltip on hover by default, so on a phone the details
 * simply never appeared. `trigger="click"` gives touch users the same
 * information by tapping; desktop keeps hover, which is the better gesture
 * when it is available.
 */
function useTooltipTrigger(): "hover" | "click" {
  return useHasHover() ? "hover" : "click";
}

const tooltipStyle = {
  backgroundColor: CHART_CHROME.tooltipBg,
  border: `1px solid ${CHART_CHROME.tooltipBorder}`,
  borderRadius: "0.75rem",
  fontSize: "11px",
};

/** Which kinds of duty the officer actually performed. */
export function DutyTypeDonut({ data }: { data: NamedValue[] }) {
  const trigger = useTooltipTrigger();
  const { t } = useLanguage();

  return (
    <ChartCard
      title={t.charts.dutyDistribution}
      subtitle={t.charts.shiftsByDutyType}
      isEmpty={data.length === 0}
      emptyText={t.charts.nothingRecorded}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} trigger={trigger} />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * Working days against holidays the officer WORKED — not holidays that
 * merely occurred. A holiday taken off is not part of either slice.
 */
export function WorkedDaysDonut({
  working,
  holiday,
}: {
  working: number;
  holiday: number;
}) {
  const trigger = useTooltipTrigger();
  const { t } = useLanguage();

  const data: NamedValue[] = [
    { name: t.charts.workingDays, value: working, color: WORKING_COLOR },
    { name: t.charts.holidaysWorked, value: holiday, color: HOLIDAY_COLOR },
  ].filter((d) => d.value > 0);

  return (
    <ChartCard
      title={t.charts.workingVsHolidayDuty}
      subtitle={t.charts.holidaysCountedOnly}
      isEmpty={data.length === 0}
      emptyText={t.charts.nothingRecorded}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color ?? WORKING_COLOR} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} trigger={trigger} />
          <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * Leave usage. A horizontal bar rather than a pie: these are counts against
 * separate allocations, not parts of one whole, and the type names need room
 * to be readable.
 */
export function LeaveUsageBar({ data }: { data: NamedValue[] }) {
  const trigger = useTooltipTrigger();
  const { t } = useLanguage();

  return (
    <ChartCard
      title={t.charts.leaveDaysTaken}
      subtitle={t.charts.byLeaveTypeColours}
      isEmpty={data.length === 0}
      emptyText={t.charts.nothingRecorded}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: CHART_CHROME.axis }}
            stroke={CHART_CHROME.grid}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: CHART_CHROME.axis }}
            stroke={CHART_CHROME.grid}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: CHART_CHROME.grid }}
            trigger={trigger}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} name={t.charts.days}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? seriesColor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** TA claimed month by month across the selected year. */
export function MonthlyTaBar({ data }: { data: NamedValue[] }) {
  const trigger = useTooltipTrigger();
  const { t } = useLanguage();
  const isEmpty = data.every((d) => d.value === 0);
  return (
    <ChartCard
      title={t.charts.travellingAllowanceByMonth}
      subtitle={t.charts.claimsAcrossYear}
      isEmpty={isEmpty}
      emptyText={t.charts.nothingRecorded}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: CHART_CHROME.axis }}
            stroke={CHART_CHROME.grid}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_CHROME.axis }}
            stroke={CHART_CHROME.grid}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: CHART_CHROME.grid }}
            trigger={trigger}
            formatter={(v) => [formatCurrency(Number(v ?? 0)), t.charts.taClaimed]}
          />
          <Bar dataKey="value" fill={seriesColor(1)} radius={[6, 6, 0, 0]} name={t.charts.ta} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
