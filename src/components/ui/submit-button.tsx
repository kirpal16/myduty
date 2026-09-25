"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import React from "react";

export interface SubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loadingText?: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  icon?: React.ElementType;
}

export function SubmitButton({
  children,
  loadingText,
  variant = "primary",
  icon: Icon,
  className = "",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const variantStyles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 border-transparent",
    secondary:
      "bg-slate-800 text-white hover:bg-slate-700 shadow-xs border-transparent",
    danger:
      "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-100",
    outline:
      "bg-card text-foreground border-border hover:bg-muted shadow-2xs",
  };

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>{loadingText || "Processing…"}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="size-4" />}
          {children}
        </>
      )}
    </button>
  );
}
