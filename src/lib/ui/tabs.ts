/**
 * Tab definitions and resolution, deliberately kept out of the client module
 * beside the component.
 *
 * The server page needs to resolve the active tab so the first paint already
 * shows the right panel. A function exported from a client module cannot be
 * called from the server — it is only ever a component or a prop — so keeping
 * the pure part here is what lets both sides share it.
 */
export type TabIconName = "user" | "calendar" | "sparkles" | "scale" | "printer";

export type TabDef = {
  /** Appears in the URL as ?tab=<id>. */
  id: string;
  label: string;
  /**
   * An icon NAME, not a component.
   *
   * A React component cannot be passed as a prop from a server component to a
   * client one — it is not serializable, and React rejects it at request time
   * with "Functions cannot be passed directly to Client Components". The
   * client module owns the name-to-component map, exactly as app-shell.tsx
   * already does for its nav icons.
   */
  icon?: TabIconName;
};

/** Picks the active tab from a search param, falling back to the first. */
export function resolveTab(tabs: TabDef[], requested: string | undefined): string {
  return tabs.some((t) => t.id === requested) ? (requested as string) : tabs[0].id;
}
