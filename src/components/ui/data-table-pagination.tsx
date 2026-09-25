"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Check, Loader2 } from "lucide-react";

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isUrlDriven?: boolean;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 15, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  isUrlDriven = true,
}: DataTablePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  /**
   * Paging is a server round trip on every page in this app, and nothing
   * acknowledged the click — on a slow connection the table simply sat there
   * looking like the button had missed.
   */
  const [isPending, startTransition] = useTransition();
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setIsPageSizeOpen(false);
      }
    }
    if (isPageSizeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPageSizeOpen]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.max(1, totalPages)) return;
    if (onPageChange) {
      onPageChange(newPage);
    }
    if (isUrlDriven) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("page", String(newPage));
      startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
    if (isUrlDriven) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("limit", String(newPageSize));
      params.set("page", "1"); // Reset to first page
      startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    }
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    /* Mobile stacks the summary above the controls and centres them; the
       row-per-page label and the first/last jumps are dropped below `sm`,
       where four chevrons plus a dropdown could not fit on one line and
       wrapped into an unusable pile. */
    <div className="flex flex-col items-stretch gap-3 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="text-center text-[11px] text-muted-foreground sm:text-left sm:text-sm">
        <span>
          Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
          <span className="font-semibold text-foreground">{endItem}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span> results
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-wrap sm:justify-end sm:gap-6">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="hidden text-muted-foreground sm:inline">Rows per page:</span>
          <span className="text-muted-foreground sm:hidden">Rows:</span>
          <div ref={pageSizeRef} className="relative">
            <button
              type="button"
              onClick={() => setIsPageSizeOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs hover:border-slate-400 dark:hover:border-slate-600 focus:outline-hidden cursor-pointer"
            >
              <span>{pageSize}</span>
              <ChevronDown
                className={`size-3 text-muted-foreground transition-transform duration-200 ${
                  isPageSizeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isPageSizeOpen && (
              <div className="absolute left-0 bottom-full z-50 mb-1 w-20 rounded-xl border border-border bg-card/95 backdrop-blur-md p-1 shadow-lg shadow-black/10 dark:shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-100">
                {pageSizeOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      handlePageSizeChange(opt);
                      setIsPageSizeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer ${
                      pageSize === opt
                        ? "bg-indigo-600 text-white font-semibold"
                        : "text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <span>{opt}</span>
                    {pageSize === opt && <Check className="size-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 flex items-center gap-1.5 whitespace-nowrap text-xs font-medium sm:mr-2 sm:text-sm">
            {isPending && (
              <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-indigo-500" />
            )}
            <span>
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={isPending || currentPage <= 1}
            aria-label="First page"
            className="hidden rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 sm:block"
          >
            <ChevronsLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={isPending || currentPage <= 1}
            aria-label="Previous page"
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={isPending || currentPage >= totalPages}
            aria-label="Next page"
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={isPending || currentPage >= totalPages}
            aria-label="Last page"
            className="hidden rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 sm:block"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
