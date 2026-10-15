"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { type Language } from "@/lib/i18n/types";

export interface LanguageToggleProps {
  variant?: "header" | "sidebar" | "auth" | "settings";
  className?: string;
}

/**
 * Custom handcrafted bilingual emblem SVG:
 * Combines an elegant globe wireframe with Latin 'A' and Gujarati 'અ' typography.
 */
function BilingualEmblemSvg({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-40"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="10"
        stroke="currentColor"
        strokeWidth="1.2"
        className="opacity-40"
      />
      <path
        d="M2.5 12h19"
        stroke="currentColor"
        strokeWidth="1.2"
        className="opacity-40"
      />
      {/* Latin 'A' Glyph */}
      <path
        d="M7.8 14.5l2.2-6 2.2 6M8.5 12.8h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Gujarati 'અ' Glyph */}
      <path
        d="M14.5 10.2c.4-.7 1.2-1.1 2-1.1 1.2 0 2 .8 2 1.8 0 1.2-.9 1.8-1.7 2.1 1 .3 1.9 1 1.9 2.2 0 1.1-.9 2-2.1 2-1 0-1.8-.5-2.2-1.3M16.8 13.5h2.8M18.8 9.5v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-amber-400"
      />
    </svg>
  );
}

export function LanguageToggle({
  variant = "header",
  className = "",
}: LanguageToggleProps) {
  const { language, setLanguage, isGujarati, isChangingLanguage } = useLanguage();
  const [pendingLang, setPendingLang] = useState<Language | null>(null);

  useEffect(() => {
    if (!isChangingLanguage) {
      setPendingLang(null);
    }
  }, [isChangingLanguage]);

  const handleSelect = (lang: Language) => {
    if (language !== lang && !isChangingLanguage) {
      setPendingLang(lang);
      setLanguage(lang);
    }
  };

  const isEnLoading = isChangingLanguage && pendingLang === "en";
  const isGuLoading = isChangingLanguage && pendingLang === "gu";

  // Header Variant (Compact, perfect for Mobile and Desktop top bars)
  if (variant === "header") {
    return (
      <div
        role="group"
        aria-label="Language selection"
        className={`inline-flex items-center rounded-xl bg-slate-900/90 dark:bg-slate-950/90 p-0.5 border border-slate-700/70 shadow-xs backdrop-blur-md transition-all select-none ${className}`}
      >
        <button
          type="button"
          onClick={() => handleSelect("en")}
          disabled={isChangingLanguage}
          aria-pressed={language === "en"}
          title="Switch to English"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold tracking-tight transition-all duration-200 cursor-pointer disabled:cursor-wait whitespace-nowrap ${
            language === "en"
              ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xs"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          {isEnLoading && <Loader2 className="size-2.5 animate-spin shrink-0" />}
          <span>EN</span>
        </button>

        <span className="w-px h-3 bg-slate-700/80 my-auto" aria-hidden="true" />

        <button
          type="button"
          onClick={() => handleSelect("gu")}
          disabled={isChangingLanguage}
          aria-pressed={language === "gu"}
          title="ગુજરાતી ભાષા પસંદ કરો"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold tracking-tight transition-all duration-200 cursor-pointer disabled:cursor-wait font-gujarati whitespace-nowrap ${
            language === "gu"
              ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-xs font-gujarati"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-gujarati"
          }`}
        >
          {isGuLoading && <Loader2 className="size-2.5 animate-spin shrink-0" />}
          <span>ગુ</span>
        </button>
      </div>
    );
  }

  // Sidebar Variant (Polished with full label and emblem)
  if (variant === "sidebar") {
    return (
      <div
        role="group"
        aria-label="Language selection"
        className={`flex flex-col gap-1.5 p-2 rounded-2xl bg-slate-800/40 border border-slate-800/80 ${className}`}
      >
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <BilingualEmblemSvg className="size-3.5 text-indigo-400" />
            <span className="text-[10px] uppercase tracking-wider">
              {isGujarati ? "ભાષા / Language" : "Language / ભાષા"}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            {language === "gu" ? "ગુજરાતી" : "English"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-900/90 border border-slate-700/70 shadow-inner">
          <button
            type="button"
            onClick={() => handleSelect("en")}
            disabled={isChangingLanguage}
            aria-pressed={language === "en"}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer disabled:cursor-wait whitespace-nowrap ${
              language === "en"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {isEnLoading && <Loader2 className="size-3 animate-spin shrink-0 text-white" />}
            <span>English</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("gu")}
            disabled={isChangingLanguage}
            aria-pressed={language === "gu"}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer disabled:cursor-wait font-gujarati whitespace-nowrap ${
              language === "gu"
                ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm shadow-amber-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {isGuLoading && <Loader2 className="size-3 animate-spin shrink-0 text-white" />}
            <span>ગુજરાતી</span>
          </button>
        </div>
      </div>
    );
  }

  // Auth Screens Variant (Floating glassmorphic pill in top right corner)
  if (variant === "auth") {
    return (
      <div
        role="group"
        aria-label="Language toggle"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-card/90 dark:bg-slate-900/90 border border-border shadow-lg backdrop-blur-md select-none ${className}`}
      >
        <BilingualEmblemSvg className="size-4 text-amber-500 shrink-0" />
        <div className="flex items-center rounded-xl bg-muted/60 p-0.5 border border-border/60">
          <button
            type="button"
            onClick={() => handleSelect("en")}
            disabled={isChangingLanguage}
            aria-pressed={language === "en"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-wait whitespace-nowrap ${
              language === "en"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isEnLoading && <Loader2 className="size-2.5 animate-spin shrink-0" />}
            <span>EN</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect("gu")}
            disabled={isChangingLanguage}
            aria-pressed={language === "gu"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-wait font-gujarati whitespace-nowrap ${
              language === "gu"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isGuLoading && <Loader2 className="size-2.5 animate-spin shrink-0" />}
            <span>ગુજરાતી</span>
          </button>
        </div>
      </div>
    );
  }

  // Settings Variant (Comprehensive setting card display)
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <BilingualEmblemSvg className="size-4 text-indigo-500" />
        <span>
          {isGujarati ? "સિસ્ટમ ભાષા પસંદ કરો" : "Select System Language"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSelect("en")}
          disabled={isChangingLanguage}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer disabled:cursor-wait ${
            language === "en"
              ? "border-indigo-600 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-600/20"
              : "border-border bg-card text-foreground hover:bg-muted/40"
          }`}
        >
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold flex items-center gap-1.5">
              {isEnLoading && <Loader2 className="size-3.5 animate-spin text-indigo-600 shrink-0" />}
              <span>English</span>
            </span>
            <span className="text-xs text-muted-foreground">Standard English Interface</span>
          </div>
          {language === "en" && !isEnLoading && (
            <span className="flex size-2 rounded-full bg-indigo-600" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSelect("gu")}
          disabled={isChangingLanguage}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer disabled:cursor-wait ${
            language === "gu"
              ? "border-amber-600 bg-amber-600/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-600/20"
              : "border-border bg-card text-foreground hover:bg-muted/40"
          }`}
        >
          <div className="flex flex-col text-left font-gujarati">
            <span className="text-sm font-bold flex items-center gap-1.5">
              {isGuLoading && <Loader2 className="size-3.5 animate-spin text-amber-600 shrink-0" />}
              <span>ગુજરાતી</span>
            </span>
            <span className="text-xs text-muted-foreground">સત્તાવાર ગુજરાત પોલીસ ઇન્ટરફેસ</span>
          </div>
          {language === "gu" && !isGuLoading && (
            <span className="flex size-2 rounded-full bg-amber-600" />
          )}
        </button>
      </div>
    </div>
  );
}
