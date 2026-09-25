"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { useState, useTransition, useEffect, useRef } from "react";

export function SearchInput({
  placeholder = "Search...",
  paramName = "search",
  defaultValue = "",
  className = "",
}: {
  placeholder?: string;
  paramName?: string;
  defaultValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(
    defaultValue || searchParams?.get(paramName) || ""
  );
  // The flag was discarded (`const [, startTransition]`), so filtering gave
  // no feedback at all — on a slow connection the page simply sat there.
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushQuery = (query: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (query.trim()) {
        params.set(paramName, query.trim());
      } else {
        params.delete(paramName);
      }
      params.set("page", "1"); // a new search starts at page 1
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Typing used to fire router.push on EVERY keystroke, so a ten-character
  // search queued ten server round trips and the results flickered through
  // each prefix on the way.
  const handleSearch = (query: string) => {
    setValue(query);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushQuery(query), 350);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClear = () => {
    setValue("");
    if (timer.current) clearTimeout(timer.current);
    pushQuery("");
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-xl border border-border bg-card pl-9 pr-9 text-xs shadow-2xs transition-colors placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
      />
      {isPending ? (
        <Loader2 className="absolute right-3 size-4 animate-spin text-indigo-500" />
      ) : (
        value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 flex items-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )
      )}
    </div>
  );
}
