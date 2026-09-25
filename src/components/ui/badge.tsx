import React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  | "secondary"
  | "purple"
  | "indigo";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  children,
  variant = "default",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
    default: {
      bg: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700",
      dot: "bg-slate-500",
    },
    success: {
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
      dot: "bg-emerald-500",
    },
    warning: {
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
      dot: "bg-amber-500",
    },
    danger: {
      bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
      dot: "bg-rose-500",
    },
    info: {
      bg: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
      dot: "bg-sky-500",
    },
    purple: {
      bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
      dot: "bg-indigo-500",
    },
    indigo: {
      bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
      dot: "bg-indigo-500",
    },
    secondary: {
      bg: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    },
    outline: {
      bg: "bg-transparent text-foreground border-border",
      dot: "bg-foreground",
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${style.bg} ${className}`}
      {...props}
    >
      {dot && <span className={`size-1.5 rounded-full ${style.dot}`} />}
      {children}
    </span>
  );
}
