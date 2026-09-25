import { Skeleton } from "./skeleton";
import { Card } from "./card";

/**
 * Composable loading shapes.
 *
 * A skeleton that does not match what follows is worse than none: the page
 * appears to change shape as it loads. Each route's `loading.tsx` describes
 * its own shape with these pieces, and every piece mirrors the markup of the
 * real component it stands in for — on a PHONE first, because that is where
 * a wrong height or a missing section is most visible.
 */

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                 */
/* -------------------------------------------------------------------------- */

/** The page shell every skeleton sits in, matching the real pages' padding. */
export function LoadingShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  /** e.g. "space-y-8" for pages that use wider section spacing. */
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full max-w-7xl px-4 py-6 duration-300 animate-in fade-in sm:px-6 lg:px-8 2xl:max-w-full ${
        className || "space-y-6"
      }`}
    >
      {children}
    </main>
  );
}

/** "← Back to …" above the header on detail, form and balance pages. */
export function BackLinkSkeleton({ width = "w-32" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width} rounded-md`} />;
}

/** Mirrors `PageHeader` (src/components/ui/page-header.tsx). */
export function PageHeaderSkeleton({
  actions = 2,
  compactActions = false,
  badge = false,
  badges = 1,
  titleLines = 1,
  actionWidths,
  actionsStretch = false,
}: {
  actions?: number;
  /** Mirror the page's own PageHeader: actions on the title row. */
  compactActions?: boolean;
  /** A pill beside the title. */
  badge?: boolean;
  badges?: number;
  /** Long titles wrap to two lines on a phone. */
  titleLines?: number;
  /** Per-button widths; buttons are h-8 on a phone like the real ones. */
  actionWidths?: string[];
  /** Calendar: a square icon button plus two buttons sharing the row. */
  actionsStretch?: boolean;
}) {
  const widths = actionWidths ?? Array.from({ length: actions }, () => "w-24 sm:w-28");
  const hasActions = actionsStretch || widths.length > 0;

  return (
    <div
      className={`flex justify-between gap-4 border-b border-border/70 pb-2 ${
        compactActions ? "flex-row items-start" : "flex-col lg:flex-row lg:items-center"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Skeleton className="h-7 w-44 rounded-xl sm:h-8 sm:w-64" />
          {titleLines > 1 && <Skeleton className="h-7 w-32 rounded-xl sm:hidden" />}
          {badge &&
            Array.from({ length: badges }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-24 shrink-0 rounded-full" />
            ))}
        </div>
        <Skeleton className="h-3.5 w-full max-w-md rounded-lg sm:h-4" />
        <Skeleton className="h-3.5 w-40 rounded-lg sm:hidden" />
      </div>
      {hasActions && (
        <div
          className={`flex items-center gap-2 ${
            compactActions ? "w-auto shrink-0" : "w-full lg:w-auto lg:shrink-0"
          }`}
        >
          {actionsStretch ? (
            <>
              <Skeleton className="h-8 w-9 shrink-0 rounded-xl sm:h-10" />
              <Skeleton className="h-8 flex-1 rounded-xl sm:h-10 lg:w-32 lg:flex-none" />
              <Skeleton className="h-8 flex-1 rounded-xl sm:h-10 lg:w-32 lg:flex-none" />
            </>
          ) : (
            widths.map((w, i) => (
              <Skeleton key={i} className={`h-8 ${w} rounded-xl sm:h-10`} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats, filters, pagination                                                  */
/* -------------------------------------------------------------------------- */

/** Mirrors `StatCard` (src/components/ui/card.tsx) and the page KPI tiles. */
export function StatCardsSkeleton({
  count = 4,
  cols = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
  gap = "gap-3.5 sm:gap-4.5",
  iconLeft = false,
  lastSpansFull = false,
  trend = false,
  trendOn,
}: {
  count?: number;
  cols?: string;
  gap?: string;
  /** Icon box before the text (duty log tiles). */
  iconLeft?: boolean;
  /** An odd last tile that spans both phone columns. */
  lastSpansFull?: boolean;
  /** A third caption line on every tile. */
  trend?: boolean;
  /** …or only on these tile indexes. */
  trendOn?: number[];
}) {
  return (
    <div className={`grid ${cols} ${gap}`}>
      {Array.from({ length: count }).map((_, i) => {
        const last = i === count - 1;
        const withTrend = trend || trendOn?.includes(i);
        const icon = <Skeleton className="size-11 shrink-0 rounded-xl sm:size-12 sm:rounded-2xl" />;
        return (
          <Card
            key={i}
            className={`flex items-center gap-3 p-4 ${iconLeft ? "" : "justify-between"} ${
              lastSpansFull && last ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            {iconLeft && icon}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-6 w-14 rounded-lg sm:h-7" />
              {withTrend && <Skeleton className="h-2.5 w-24 rounded-md" />}
            </div>
            {!iconLeft && icon}
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Mirrors the list pages' filter cards.
 *
 * - default: search, then `count` full-width dropdowns (duty, leave, reports)
 * - `divided`: dropdowns sit under a border-t, as on duty and leave
 * - `inline`: fixed-width controls that wrap on one row (holidays, storage)
 * - `pills`: short pill links (admin users)
 */
export function FilterBarSkeleton({
  count = 4,
  search = true,
  resetButton = false,
  divided = false,
  inline,
  pills = 0,
  helpLine = false,
}: {
  count?: number;
  search?: boolean;
  resetButton?: boolean;
  divided?: boolean;
  /** Widths of wrapping inline controls, e.g. ["w-28", "w-20"]. */
  inline?: string[];
  pills?: number;
  /** A line of help text under the search (admin permissions). */
  helpLine?: boolean;
}) {
  const dropdowns =
    count > 0 && !inline ? (
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${
          divided ? "border-t border-border/50 pt-2.5" : ""
        }`}
      >
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-xl sm:w-36" />
        ))}
      </div>
    ) : null;

  return (
    <Card className="space-y-3 p-3.5 sm:p-4">
      {(search || resetButton) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {search && <Skeleton className="h-9 w-full rounded-xl sm:max-w-md" />}
          {resetButton && <Skeleton className="h-9 w-24 shrink-0 rounded-xl" />}
        </div>
      )}
      {helpLine && <Skeleton className="mx-auto h-3 w-64 max-w-full rounded-md sm:mx-0" />}
      {dropdowns}
      {inline && (
        <div className="flex flex-wrap items-center gap-2">
          {inline.map((w, i) => (
            <Skeleton key={i} className={`h-9 ${w} rounded-xl`} />
          ))}
        </div>
      )}
      {pills > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: pills }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-xl" />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Mirrors `DataTablePagination`: summary line, then rows + prev/next. */
export function PaginationSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <Skeleton className="mx-auto h-3 w-40 rounded-md sm:mx-0" />
      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-6">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="size-7 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                       */
/* -------------------------------------------------------------------------- */

export type MobileCardVariant =
  | "generic"
  | "duty"
  | "leave"
  | "report"
  | "holiday"
  | "file"
  | "user"
  | "row";

/** One phone list card, shaped like the real card of each list page. */
export function MobileCardSkeleton({
  variant = "generic",
  rowButtons = 1,
  description = false,
  colorDot = false,
}: {
  variant?: MobileCardVariant;
  /** `row` variant: how many buttons sit on the right. */
  rowButtons?: number;
  /** `row` variant: a description line (admin profiles). */
  description?: boolean;
  /** `row` variant: a colour dot before the name (admin leave types). */
  colorDot?: boolean;
}) {
  switch (variant) {
    case "duty":
      return (
        <div className="space-y-3 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-lg" />
              <Skeleton className="size-5 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 p-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-2.5 w-10 rounded-md" />
                <Skeleton className="h-3.5 w-24 rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-40 rounded-md" />
          <div className="flex items-center justify-between border-t border-border/40 pt-2">
            <Skeleton className="h-3.5 w-32 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-full rounded-xl" />
        </div>
      );

    case "leave":
      return (
        <div className="space-y-3 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-lg" />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5">
            <Skeleton className="size-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-3.5 flex-1 rounded-md" />
            <Skeleton className="h-5 w-12 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex gap-2 border-t border-border/40 pt-2">
            <Skeleton className="h-8 flex-1 rounded-xl" />
            <Skeleton className="h-8 flex-1 rounded-xl" />
          </div>
        </div>
      );

    case "report":
      return (
        <div className="space-y-2.5 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-lg" />
              <Skeleton className="size-5 rounded-md" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          ))}
        </div>
      );

    case "holiday":
      return (
        <div className="space-y-2.5 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-32 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      );

    case "file":
      return (
        <div className="space-y-3 bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-full rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border/40 pt-3">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </div>
        </div>
      );

    case "user":
      return (
        <div className="space-y-3 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2 border-t border-border/40 pt-2">
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 flex-1 rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        </div>
      );

    case "row":
      return (
        <div className="flex items-center justify-between gap-3 bg-card p-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {colorDot && <Skeleton className="size-3.5 shrink-0 rounded-full" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-3.5 w-12 rounded-full" />
              </div>
              {description && <Skeleton className="h-3 w-full rounded-md" />}
            </div>
          </div>
          <div className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1.5">
            {Array.from({ length: rowButtons }).map((_, i) => (
              <Skeleton key={i} className={`h-7 ${rowButtons > 1 ? "w-14" : "w-24"} rounded-xl`} />
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-3 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-lg" />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
        </div>
      );
  }
}

export function TableSkeleton({
  rows = 6,
  selectable = false,
  daysColumn = false,
  mobileVariant = "generic",
  mobileRows,
  pagination = false,
  mobileMode = "cards",
  rowButtons,
  description,
  colorDot,
}: {
  rows?: number;
  /** A leading checkbox column (the duty log's bulk select). */
  selectable?: boolean;
  /** A "5 Days" badge with coloured type chips under it (the leave log). */
  daysColumn?: boolean;
  /** Which real phone card to mirror below `md`. */
  mobileVariant?: MobileCardVariant;
  mobileRows?: number;
  /** `DataTablePagination` inside the card. */
  pagination?: boolean;
  /** "table": the page has no phone cards, only a sideways-scrolling table. */
  mobileMode?: "cards" | "table";
  rowButtons?: number;
  description?: boolean;
  colorDot?: boolean;
}) {
  const table = (
    <>
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-3.5">
        <div className="flex flex-1 items-center gap-8">
          {selectable && <Skeleton className="size-4 shrink-0 rounded" />}
          <Skeleton className="h-3.5 w-28 rounded-md" />
          {daysColumn && <Skeleton className="h-3.5 w-12 rounded-md" />}
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-40 rounded-md" />
        </div>
        <Skeleton className="h-3.5 w-16 shrink-0 rounded-md" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 px-6 py-4">
            {selectable && <Skeleton className="size-4 shrink-0 rounded" />}
            <div className="flex w-40 shrink-0 items-center gap-2.5">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 shrink-0 rounded-lg" />
            <div className="flex w-36 shrink-0 items-center gap-2">
              <Skeleton className="size-3.5 rounded-sm" />
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            {daysColumn && (
              <div className="flex w-24 shrink-0 flex-col gap-1">
                <Skeleton className="h-5 w-16 rounded-lg" />
                <div className="flex gap-1">
                  <Skeleton className="h-3.5 w-10 rounded-md" />
                  <Skeleton className="h-3.5 w-10 rounded-md" />
                </div>
              </div>
            )}
            <Skeleton className="h-6 w-20 shrink-0 rounded-lg" />
            <Skeleton className="h-4 max-w-xs flex-1 rounded-md" />
            <div className="flex w-28 shrink-0 items-center justify-end gap-2">
              <Skeleton className="h-7 w-12 rounded-lg" />
              <Skeleton className="h-7 w-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Card className="overflow-hidden border border-border/70 p-0 shadow-xs">
      {mobileMode === "table" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">{table}</div>
        </div>
      ) : (
        <>
          <div className="hidden md:block">{table}</div>
          <div className="divide-y divide-border/60 md:hidden">
            {Array.from({ length: mobileRows ?? Math.min(rows, 5) }).map((_, i) => (
              <MobileCardSkeleton
                key={i}
                variant={mobileVariant}
                rowButtons={rowButtons}
                description={description}
                colorDot={colorDot}
              />
            ))}
          </div>
        </>
      )}
      {pagination && <PaginationSkeleton />}
    </Card>
  );
}

export function ChartGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-3 p-4 sm:p-5">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms and side cards                                                        */
/* -------------------------------------------------------------------------- */

function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-28 rounded-md" />
      <Skeleton className={`${tall ? "h-20" : "h-10"} w-full rounded-xl`} />
    </div>
  );
}

/** Mirrors the duty / leave entry forms and the settings forms. */
export function FormSkeleton({
  fields = 6,
  dateRow = false,
  accordions = 0,
  chips = false,
  heading = false,
  checkboxRow = false,
  infoBox = false,
  panel = false,
  textarea = false,
  upload = false,
  dividers = false,
  singleButton = false,
  avatarHeader = false,
  padding = "p-6 sm:p-8",
}: {
  fields?: number;
  /** A two-column start/end date row first (stacks on a phone). */
  dateRow?: boolean;
  /** Collapsed sections: the TA claim, the day-by-day leave breakdown. */
  accordions?: number;
  /** A row of coloured type chips (the leave breakdown summary). */
  chips?: boolean;
  /** A small section heading at the top ("Shift Details & Timing"). */
  heading?: boolean;
  /** The dashed "Claim holiday pay" checkbox row. */
  checkboxRow?: boolean;
  /** A short info box after the first field (the leave balance). */
  infoBox?: boolean;
  /** A tall bordered block after the fields (the sanction picker panel). */
  panel?: boolean;
  /** A textarea (reason) after the fields. */
  textarea?: boolean;
  /** The dashed attachment dropzone. */
  upload?: boolean;
  /** Border-t dividers before the accordions and the buttons. */
  dividers?: boolean;
  /** One right-aligned submit instead of Cancel + Submit. */
  singleButton?: boolean;
  /** Avatar + name header (settings profile). */
  avatarHeader?: boolean;
  padding?: string;
}) {
  return (
    <Card className={`space-y-5 ${padding}`}>
      {avatarHeader && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      )}
      {heading && <Skeleton className="h-3 w-40 rounded-md" />}
      {dateRow && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      )}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-5">
          <FieldSkeleton />
          {infoBox && i === 0 && <Skeleton className="h-12 w-full rounded-xl" />}
        </div>
      ))}
      {checkboxRow && (
        <Skeleton className="h-11 w-full rounded-xl border border-dashed border-border/70" />
      )}
      {panel && (
        <div className="space-y-3 rounded-2xl border border-border/70 p-4">
          <div className="flex items-start gap-2.5">
            <Skeleton className="size-4 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-56 max-w-full rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-40 rounded-md" />
            <Skeleton className="h-2.5 w-32 rounded-md" />
          </div>
        </div>
      )}
      {chips && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-lg" />
          ))}
        </div>
      )}
      {accordions > 0 && (
        <div className={`space-y-3 ${dividers ? "border-t border-border/80 pt-4" : ""}`}>
          {Array.from({ length: accordions }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-md" />
                <Skeleton className="h-3 w-44 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="size-4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}
      {textarea && <FieldSkeleton tall />}
      {upload && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-48 rounded-md" />
          <Skeleton className="h-32 w-full rounded-2xl border-2 border-dashed border-border/70" />
        </div>
      )}
      <div className={`flex justify-end gap-2 ${dividers ? "border-t border-border pt-4" : ""}`}>
        {!singleButton && <Skeleton className="h-10 w-20 rounded-xl" />}
        <Skeleton className="h-10 w-36 rounded-xl sm:w-40" />
      </div>
    </Card>
  );
}

/** Two-column form page: form on the left, help cards stacked below on a phone. */
export function FormPageGrid({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">{children}</div>
      {sidebar && <div className="space-y-6">{sidebar}</div>}
    </div>
  );
}

/** A sidebar / help card: header then rows (optionally with progress bars). */
export function SidebarCardSkeleton({
  rows = 2,
  bars = false,
  subtitle = true,
}: {
  rows?: number;
  /** Allowance rows: a name/count line over a thin progress bar. */
  bars?: boolean;
  subtitle?: boolean;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40 rounded-md" />
        {subtitle && <Skeleton className="h-3 w-52 rounded-md" />}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) =>
          bars ? (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ) : (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ),
        )}
      </div>
    </Card>
  );
}

/** Admin "Add …" form card that sits beside the list (below it on a phone). */
export function SideFormCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <Skeleton className="h-3 w-56 max-w-full rounded-md" />
      </div>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-10 w-full rounded-xl" />
    </Card>
  );
}

/** List on the left, an add-form card beside it (below it on a phone). */
export function ListWithSideFormSkeleton({
  list,
  side,
}: {
  list: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">{list}</div>
      <div>{side}</div>
    </div>
  );
}

/** Search-only filter card used by the admin list pages. */
export function SearchCardSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-9 w-full max-w-sm rounded-xl" />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Route-specific shapes                                                       */
/* -------------------------------------------------------------------------- */

/** Duty detail: one "Shift Information" card and the allowances card. */
export function DutyDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="space-y-5 p-6">
          <Skeleton className="h-4 w-40 rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3.5">
                <Skeleton className="h-2.5 w-20 rounded-md" />
                <Skeleton className="h-4 w-36 rounded-md" />
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
        </Card>
      </div>
      <Card className="space-y-4 p-5">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      </Card>
    </div>
  );
}

/** Leave balance: the amber Holiday Leave card. */
export function HolidayLeaveCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton className="h-7 w-8 rounded-md" />
          </div>
          <Skeleton className="h-3 w-56 max-w-full rounded-md" />
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

/** Leave balance: the ledger card — one row per leave type. */
export function BalanceLedgerSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
        </div>
        <Skeleton className="h-4 w-14 rounded-md" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 p-2.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="mx-auto h-2.5 w-12 rounded-md" />
                  <Skeleton className="mx-auto h-4 w-6 rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2.5 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * The calendar, as a phone sees it on first load: KPI tiles, the month card
 * (navigator, view switch, category chips, a flush 7-column grid), the
 * phone-only selected-day panel, and the bottom tabs opened on "Holidays".
 */
export function CalendarSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs sm:gap-3 sm:rounded-3xl sm:p-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl sm:size-11 sm:rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-16 rounded-md sm:h-3 sm:w-20" />
                <Skeleton className="h-4 w-10 rounded-md sm:h-6 sm:w-14" />
              </div>
            </div>
            {i !== 1 && (
              <Skeleton className="size-6 shrink-0 rounded-lg sm:size-8 sm:rounded-xl" />
            )}
          </div>
        ))}
      </div>

      <Card className="overflow-hidden rounded-3xl border border-border p-0 shadow-xs">
        {/* Navigator + view switch */}
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3 md:justify-start">
            <Skeleton className="h-9 w-32 rounded-2xl" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          <Skeleton className="h-9 w-56 rounded-2xl" />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
          <Skeleton className="h-3 w-12 rounded-md" />
          {["w-16", "w-16", "w-16", "w-32"].map((w, i) => (
            <Skeleton key={i} className={`h-6 ${w} rounded-lg`} />
          ))}
        </div>

        {/* Weekday strip */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 py-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-3 w-6 rounded-md" />
          ))}
        </div>

        {/* Flush month grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[64px] p-1.5 sm:min-h-[110px] md:min-h-[125px]">
              <Skeleton className="size-6 rounded-full" />
            </div>
          ))}
        </div>

        {/* Phone-only selected-day panel */}
        <div className="space-y-3 border-t border-border bg-muted/20 p-4 sm:hidden">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 rounded-xl" />
            <Skeleton className="h-8 rounded-xl" />
          </div>
        </div>
      </Card>

      {/* Bottom tabs, opened on Holidays & Offs */}
      <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="border-b border-border/70 pb-3">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-muted/60 p-1 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-3 w-40 rounded-md" />
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-4 rounded-md" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28 rounded-md" />
                    <Skeleton className="h-2.5 w-44 rounded-md" />
                  </div>
                </div>
                <Skeleton className="size-4 rounded-md" />
              </div>
              {i === 0 &&
                Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="border-t border-border/40 px-4 py-2.5">
                    <Skeleton className="h-6 w-full rounded-lg" />
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The dashboard body below the period filter. Shared by `dashboard/loading.tsx`
 * and the page's own Suspense fallback, so switching from one to the other is
 * invisible.
 */
export function DashboardBodySkeleton() {
  return (
    <>
      <StatCardsSkeleton count={5} lastSpansFull trend />
      <ChartGridSkeleton />

      {/* Leave position */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </Card>

      {/* Allowance banner */}
      <Card className="space-y-3 p-4 sm:p-5">
        <Skeleton className="h-3 w-48 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent duties */}
        <Card className="overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-lg" />
                </div>
                <Skeleton className="h-3 w-32 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border p-4">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </Card>

        <div className="space-y-6">
          {/* Recent leaves */}
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-14 rounded-md" />
            </div>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </Card>
          {/* Quick hub */}
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </Card>
        </div>
      </div>

      {/* Career timeline */}
      <Card className="space-y-3 p-4 sm:p-5">
        <Skeleton className="h-4 w-40 rounded-md" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-3 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

/** Two-column detail view: content beside a sidebar. Kept for other callers. */
export function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="space-y-3 p-6">
          <Skeleton className="h-5 w-48 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </Card>
        <Card className="space-y-3 p-6">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </Card>
      </div>
      <Card className="space-y-3 p-5">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </Card>
    </div>
  );
}
