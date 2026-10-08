"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SelectionCtx = {
  selectableIds: readonly string[];
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
  selectMode: boolean;
  setSelectMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  toggleSelectMode: () => void;
};

const defaultCtx: SelectionCtx = {
  selectableIds: [],
  selected: new Set(),
  toggle: () => {},
  setAll: () => {},
  clear: () => {},
  selectMode: false,
  setSelectMode: () => {},
  toggleSelectMode: () => {},
};

export const DutySelectionContext = createContext<SelectionCtx>(defaultCtx);

export function useDutySelection(): SelectionCtx {
  return useContext(DutySelectionContext) ?? defaultCtx;
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
  const [selectMode, setSelectMode] = useState(false);

  // Ids that left the page drop out of the selection by derivation.
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

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setPicked(new Set());
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      selectableIds,
      selected,
      toggle,
      setAll,
      clear,
      selectMode,
      setSelectMode,
      toggleSelectMode,
    }),
    [selectableIds, selected, toggle, setAll, clear, selectMode, toggleSelectMode],
  );

  return (
    <DutySelectionContext.Provider value={value}>
      {children}
    </DutySelectionContext.Provider>
  );
}
