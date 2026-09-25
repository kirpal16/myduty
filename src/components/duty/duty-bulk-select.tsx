"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { deleteDuties } from "@/actions/duty";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";

/**
 * Multi-select for the duty log. The table itself stays a server component;
 * only these checkboxes and the action bar are client-side, sharing the
 * selection through context.
 */
type SelectionCtx = {
  selectableIds: readonly string[];
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const Ctx = createContext<SelectionCtx | null>(null);

function useSelection(): SelectionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Duty selection controls must sit inside DutySelectionProvider");
  return ctx;
}

export function DutySelectionProvider({
  selectableIds,
  children,
}: {
  /** The caller's own duties on this page — the only ones they may delete. */
  selectableIds: string[];
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  // Ids that left the page (deleted, filtered out, paged away) drop out of
  // the selection by derivation, not by an effect.
  const selected = useMemo(() => {
    const allowed = new Set(selectableIds);
    return new Set([...picked].filter((id) => allowed.has(id)));
  }, [picked, selectableIds]);

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (on: boolean) => setPicked(on ? new Set(selectableIds) : new Set()),
    [selectableIds],
  );

  const clear = useCallback(() => setPicked(new Set()), []);

  const value = useMemo(
    () => ({ selectableIds, selected, toggle, setAll, clear }),
    [selectableIds, selected, toggle, setAll, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function DutyRowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle, selectableIds } = useSelection();
  if (!selectableIds.includes(id)) return null;
  return (
    <Checkbox
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
    />
  );
}

export function DutySelectAllCheckbox() {
  const { selected, selectableIds, setAll } = useSelection();
  if (selectableIds.length === 0) return null;
  const all = selected.size === selectableIds.length;
  return (
    <Checkbox
      checked={all}
      indeterminate={selected.size > 0 && !all}
      onChange={() => setAll(!all)}
      aria-label={all ? "Deselect all duties on this page" : "Select all duties on this page"}
    />
  );
}

export function DutyBulkActionBar() {
  const { selected, clear, selectableIds, setAll } = useSelection();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  if (selected.size === 0) return null;
  const count = selected.size;

  const handleConfirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const ids = [...selected];

    startTransition(async () => {
      try {
        const { deleted } = await deleteDuties(ids);
        setIsOpen(false);
        clear();
        router.refresh();
        toast(`${deleted} ${deleted === 1 ? "duty" : "duties"} deleted.`);
      } catch (error) {
        toast(
          error instanceof Error && error.message
            ? error.message
            : "Those duties could not be deleted. Please try again.",
          "error",
        );
      } finally {
        inFlight.current = false;
      }
    });
  };

  return (
    <>
      <div className="sticky top-16 md:top-0 z-20 flex items-center justify-between gap-2 border-b border-indigo-500/30 bg-card/95 backdrop-blur-md px-3.5 py-2.5 sm:px-6 rounded-t-2xl shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold text-foreground min-w-0">
          <span className="whitespace-nowrap">
            {count} selected
          </span>
          {count < selectableIds.length && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer whitespace-nowrap text-xs"
            >
              <span className="sm:hidden">All ({selectableIds.length})</span>
              <span className="hidden sm:inline">Select all {selectableIds.length}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors"
          >
            <X className="size-3.5" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>Delete {count}</span>
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={`Delete ${count} Duty ${count === 1 ? "Record" : "Records"}`}
        description={`Are you sure you want to delete ${count} selected ${
          count === 1 ? "shift" : "shifts"
        }? Travelling allowance claims attached to them will also be removed. This cannot be undone.`}
        confirmLabel={`Delete ${count}`}
        isPending={isPending}
      />
    </>
  );
}
