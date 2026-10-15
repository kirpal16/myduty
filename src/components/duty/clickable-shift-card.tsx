"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface ShiftSelectionContextType {
  selectedId: string;
  selectShift: (id: string) => void;
}

const ShiftSelectionContext = createContext<ShiftSelectionContextType | null>(null);

export function ShiftSelectionProvider({
  initialId,
  children,
}: {
  initialId: string;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(initialId);

  const selectShift = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/duty/${id}`);
    }
  };

  return (
    <ShiftSelectionContext.Provider value={{ selectedId, selectShift }}>
      {children}
    </ShiftSelectionContext.Provider>
  );
}

interface ClickableShiftCardProps {
  id: string;
  isInitialCurrent?: boolean;
  isMultiShift: boolean;
  children: ReactNode;
}

export function ClickableShiftCard({
  id,
  isInitialCurrent = false,
  isMultiShift,
  children,
}: ClickableShiftCardProps) {
  const context = useContext(ShiftSelectionContext);
  const isSelected = context ? context.selectedId === id : isInitialCurrent;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking an interactive child (Edit link, Delete button, etc.), don't trigger selection
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, [data-prevent-card-click]")) {
      return;
    }
    if (isMultiShift && context) {
      context.selectShift(id);
    }
  };

  return (
    <Card
      onClick={handleClick}
      className={`p-6 transition-all ${
        isMultiShift && !isSelected
          ? "cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs border-border/80"
          : ""
      } ${
        isSelected && isMultiShift
          ? "ring-2 ring-indigo-600 dark:ring-indigo-500 border-indigo-600 dark:border-indigo-500 bg-indigo-500/[0.03] shadow-xs"
          : !isMultiShift
            ? "border-border/80"
            : ""
      }`}
    >
      {children}
    </Card>
  );
}
