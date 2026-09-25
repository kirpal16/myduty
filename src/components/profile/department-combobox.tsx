"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Search,
  Loader2,
  X,
} from "lucide-react";
import { createOrGetDepartmentAction } from "@/actions/profile";

export interface DepartmentOption {
  id: string;
  name: string;
}

interface DepartmentComboboxProps {
  name?: string;
  initialDepartmentId?: string | null;
  departments: DepartmentOption[];
  onSelect?: (departmentId: string, departmentName: string) => void;
  disabled?: boolean;
}

export function DepartmentCombobox({
  name = "departmentId",
  initialDepartmentId = "",
  departments: initialDepartments,
  onSelect,
  disabled = false,
}: DepartmentComboboxProps) {
  const [departments, setDepartments] = useState<DepartmentOption[]>(initialDepartments);
  const [selectedId, setSelectedId] = useState<string>(initialDepartmentId ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [creationError, setCreationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if initialDepartmentId changes
  useEffect(() => {
    if (initialDepartmentId !== undefined) {
      setSelectedId(initialDepartmentId ?? "");
    }
  }, [initialDepartmentId]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedDepartment = departments.find((d) => d.id === selectedId);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const exactMatch = departments.some(
    (d) => d.name.toLowerCase() === search.trim().toLowerCase()
  );

  const canCreateNew = search.trim().length >= 2 && !exactMatch;

  const handleSelect = (deptId: string, deptName: string) => {
    setSelectedId(deptId);
    setIsOpen(false);
    setSearch("");
    setCreationError(null);
    onSelect?.(deptId, deptName);
  };

  const handleCreateNew = () => {
    const trimmed = search.trim();
    if (trimmed.length < 2) return;

    setCreationError(null);
    startTransition(async () => {
      const res = await createOrGetDepartmentAction(trimmed);
      if (res.success && res.data) {
        const newDept: DepartmentOption = {
          id: res.data.id,
          name: res.data.name,
        };
        // Add if not present
        setDepartments((prev) => {
          if (prev.some((d) => d.id === newDept.id)) return prev;
          return [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name));
        });
        handleSelect(newDept.id, newDept.name);
      } else {
        setCreationError(res.error ?? "Failed to create department.");
      }
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input so form submissions capture the selected departmentId */}
      <input type="hidden" name={name} value={selectedId} />

      {/* Main trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`w-full flex items-center justify-between min-h-[44px] rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99] ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20"
            : "border-border hover:border-border/80"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Building2 className="size-4" />
          </div>
          <span
            className={`truncate font-medium ${
              selectedDepartment ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {selectedDepartment ? selectedDepartment.name : "— Select or add department —"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground ml-2">
          {selectedId && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect("", "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleSelect("", "");
                }
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 opacity-70" />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border/90 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Search Input Box */}
          <div className="p-2 border-b border-border/60">
            <div className="relative flex items-center">
              <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canCreateNew) {
                      handleCreateNew();
                    } else if (filtered.length > 0) {
                      handleSelect(filtered[0].id, filtered[0].name);
                    }
                  } else if (e.key === "Escape") {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search or type department name..."
                className="w-full rounded-xl border border-border/80 bg-background/80 py-2 pl-9 pr-8 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Creation error if any */}
          {creationError && (
            <div className="px-3 py-1.5 text-xs text-rose-500 bg-rose-500/10 border-b border-rose-500/20">
              {creationError}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 overscroll-contain">
            {/* Unassign option */}
            <button
              type="button"
              onClick={() => handleSelect("", "— Unassigned —")}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-xl transition-colors text-left ${
                selectedId === ""
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <span>— Unassigned —</span>
              {selectedId === "" && <Check className="size-4 shrink-0" />}
            </button>

            {filtered.map((dept) => {
              const isSelected = dept.id === selectedId;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelect(dept.id, dept.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-xl transition-colors text-left ${
                    isSelected
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : "text-foreground hover:bg-muted/80"
                  }`}
                >
                  <span className="truncate">{dept.name}</span>
                  {isSelected && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}

            {filtered.length === 0 && !canCreateNew && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No matching departments found.
              </div>
            )}
          </div>

          {/* Add New Department button if user typed something new */}
          {canCreateNew && (
            <div className="p-1.5 border-t border-border/60 bg-muted/30">
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreateNew}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-sm transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Adding department...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    <span className="truncate">
                      Add department &ldquo;{search.trim()}&rdquo;
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
