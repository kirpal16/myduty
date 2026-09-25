import React from "react";
import { NavLink as Link } from "@/components/ui/nav-link";

export function Card({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border/60 ${className}`}
    >
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "indigo",
  className = "",
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: "indigo" | "emerald" | "amber" | "sky" | "rose" | "purple";
  className?: string;
  /**
   * Makes the whole tile a link. A KPI answers "how many?" and the natural
   * next question is "which ones?" — without this the number was a dead end.
   */
  href?: string;
}) {
  const colorMap = {
    indigo: {
      bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      accent: "from-indigo-500 to-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      accent: "from-emerald-500 to-emerald-600",
    },
    amber: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      accent: "from-amber-500 to-amber-600",
    },
    sky: {
      bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      accent: "from-sky-500 to-sky-600",
    },
    rose: {
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      accent: "from-rose-500 to-rose-600",
    },
    purple: {
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      accent: "from-purple-500 to-purple-600",
    },
  };

  const scheme = colorMap[color] ?? colorMap.indigo;

  const shell = `relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-4.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3 min-w-0 ${className}`;

  const body = (
    <>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${scheme.accent} opacity-80`} />

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span
          className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate"
          title={title}
        >
          {title}
        </span>
        <span
          className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate mt-0.5"
          title={String(value)}
        >
          {value}
        </span>
        {trend && (
          <span
            className="text-[11px] text-muted-foreground/80 truncate mt-0.5"
            title={trend}
          >
            {trend}
          </span>
        )}
      </div>

      <div
        className={`flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-2xl border shadow-2xs ${scheme.bg}`}
      >
        <Icon className="size-5 sm:size-5.5" />
      </div>
    </>
  );

  // A linked tile and a plain one are rendered as separate elements rather
  // than one dynamic tag, so each keeps its own correct prop types.
  return href ? (
    <Link href={href} className={`${shell} cursor-pointer`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
