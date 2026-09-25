"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

/**
 * A native checkbox with the app's styling. Native on purpose: it stays
 * keyboard- and screen-reader-correct for free. `indeterminate` is a DOM
 * property with no HTML attribute, so it is set on the element directly.
 */
export function Checkbox({
  indeterminate = false,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={`size-4 shrink-0 cursor-pointer rounded border border-input bg-card accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
