"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { Language, Translations } from "./types";
import { en } from "./dictionaries/en";
import { gu } from "./dictionaries/gu";

const dictionaries: Record<Language, Translations> = { en, gu };

export type TranslationFunction = ((path: string, fallback?: string) => string) & Translations;

interface LanguageContextValue {
  language: Language;
  lang: Language;
  isChangingLanguage: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationFunction;
  isGujarati: boolean;
  isEnglish: boolean;
  dictionary: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "app_lang";
const COOKIE_KEY = "app_lang";

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const transitionStartRef = useRef<number>(0);
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "en" || stored === "gu") return stored;
    }
    return initialLanguage;
  });

  // Keep cookie & html lang in sync on mount and change
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check localStorage first for PWA standalone consistency
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && (stored === "en" || stored === "gu") && stored !== language) {
      setLanguageState(stored);
      document.cookie = `${COOKIE_KEY}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = stored;
      return;
    }

    document.cookie = `${COOKIE_KEY}=${language}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  // Once transition completes, smoothly clear skeleton state with minimum display duration
  useEffect(() => {
    if (!isPending && isChangingLanguage) {
      const elapsed = Date.now() - transitionStartRef.current;
      const remaining = Math.max(0, 350 - elapsed);
      const timer = setTimeout(() => {
        setIsChangingLanguage(false);
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [isPending, isChangingLanguage]);

  // Safety fallback: Never keep isChangingLanguage stuck true for > 2500ms
  useEffect(() => {
    if (isChangingLanguage) {
      const safetyTimer = setTimeout(() => {
        setIsChangingLanguage(false);
      }, 2500);
      return () => clearTimeout(safetyTimer);
    }
  }, [isChangingLanguage]);

  // Listen to cross-tab or standalone PWA storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "en" || e.newValue === "gu")) {
        transitionStartRef.current = Date.now();
        setIsChangingLanguage(true);
        setLanguageState(e.newValue);
        document.cookie = `${COOKIE_KEY}=${e.newValue}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.lang = e.newValue;
        try {
          startTransition(() => {
            router.refresh();
          });
        } catch {
          // Graceful fallback
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  const setLanguage = useCallback((newLang: Language) => {
    if (newLang === language) return;
    transitionStartRef.current = Date.now();
    setIsChangingLanguage(true);
    setLanguageState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `${COOKIE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLang;
      window.dispatchEvent(new CustomEvent("app-language-change", { detail: newLang }));

      // Immediately refresh active Next.js Server Components with the new language cookie
      try {
        startTransition(() => {
          router.refresh();
        });
      } catch {
        // Graceful fallback
      }
    }
  }, [language, router]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "gu" : "en");
  }, [language, setLanguage]);

  const dictionary = useMemo(() => dictionaries[language] ?? en, [language]);

  /**
   * Helper function to resolve dot-notation path like "common.save" or "duty.addDuty".
   * Falls back to English, then to provided fallback string, then path itself.
   */
  const t = useMemo<TranslationFunction>(() => {
    const fn = (path: string, fallback?: string): string => {
      const keys = path.split(".");
      let current: any = dictionary;
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }

      if (typeof current === "string") return current;

      // Fallback to English dictionary
      let enCurrent: any = en;
      for (const k of keys) {
        if (enCurrent && typeof enCurrent === "object" && k in enCurrent) {
          enCurrent = enCurrent[k];
        } else {
          enCurrent = undefined;
          break;
        }
      }

      if (typeof enCurrent === "string") return enCurrent;

      return fallback ?? path;
    };

    return Object.assign(fn, dictionary) as TranslationFunction;
  }, [dictionary]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      lang: language,
      isChangingLanguage: isChangingLanguage || isPending,
      setLanguage,
      toggleLanguage,
      t,
      isGujarati: language === "gu",
      isEnglish: language === "en",
      dictionary,
    }),
    [language, isChangingLanguage, isPending, setLanguage, toggleLanguage, t, dictionary],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if called outside provider (e.g. in standalone tests)
    const fallbackFn = (path: string, fallback?: string) => fallback ?? path;
    return {
      language: "en",
      lang: "en",
      isChangingLanguage: false,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: Object.assign(fallbackFn, en) as TranslationFunction,
      isGujarati: false,
      isEnglish: true,
      dictionary: en,
    };
  }
  return context;
}
