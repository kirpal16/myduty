/**
 * The minimal shape of a PostgREST query builder, so one filter chain can be
 * applied to several queries without importing the library's deeply generic
 * builder type (or falling back to `any`).
 *
 * Self-referential on purpose: every method returns the same builder, which is
 * what makes the chain composable.
 */
export type Filterable<T> = {
  eq(column: string, value: unknown): T;
  not(column: string, operator: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  or(filters: string): T;
};

/**
 * PostgREST's `or` takes a comma-separated list wrapped in an expression
 * grammar, so an unescaped comma or parenthesis in user input changes the
 * filter rather than being searched for.
 */
export function sanitizeSearch(term: string): string {
  return term.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}
