import React from "react";

export function PageHeader({
  title,
  shortTitle,
  subtitle,
  badge,
  actions,
  compactActions = false,
  className = "",
}: {
  title: string;
  /**
   * Shown below `sm` in place of `title`.
   *
   * For a long name a phone forces a choice: the title alone on row one, or a
   * shorter name with its badge beside it. "Document & File Vault" needs
   * 202px of a 343px row, which leaves nothing for the file count — "File
   * Vault" leaves room for both.
   */
  shortTitle?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * Keeps the actions on the title's own row at every width, top-right,
   * instead of giving them a full-width row of their own below `lg`.
   *
   * For one or two short buttons a whole row is wasted space — on a phone
   * "Duty Log Book" and "Log New Duty" fit side by side easily, and stacking
   * them pushed the actual content down a row for nothing. Pages with three
   * buttons (the calendar) leave this off, because there they genuinely do
   * need the row.
   */
  compactActions?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between gap-4 pb-2 border-b border-border/70 ${
        compactActions
          ? "flex-row items-start"
          : "flex-col lg:flex-row lg:items-center"
      } ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Wrap, don't stack. Whether the badge fits beside the title depends
            on how long the title is, not on the screen width: "Leave Log Book"
            has room to spare on a phone, "Interactive Duty & Roster Calendar"
            has none at any breakpoint. Letting the row wrap gets both right —
            a breakpoint rule got one or the other wrong every time.
            `shrink-0` stops the pill itself from being squeezed into two
            lines when it does sit alongside. */}
        <div className="flex flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-balance text-foreground sm:text-2xl xl:text-3xl">
            {shortTitle ? (
              <>
                <span className="sm:hidden">{shortTitle}</span>
                <span className="hidden sm:inline">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div
          className={`flex items-center gap-2 lg:gap-3 ${
            compactActions
              ? "w-auto shrink-0"
              : /* Full width below `lg` so several buttons share the second
                   row evenly rather than leaving a ragged last one. */
                "w-full flex-wrap lg:w-auto lg:shrink-0 lg:flex-nowrap"
          }`}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
