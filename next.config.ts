import type { NextConfig } from "next";

/**
 * Deliberately close to empty.
 *
 * `experimental.optimizePackageImports: ["lucide-react", "recharts"]` used to
 * live here, described as "the single biggest dev-compile saving available".
 * It was neither: both packages are on Next's built-in optimized list, and
 * under Turbopack — the default bundler since Next 16 — the option does
 * nothing at all. The docs are explicit: "Turbopack automatically analyzes
 * imports and optimizes them. It does not require this configuration."
 *
 * Removed rather than left in place, so nobody spends time tuning a setting
 * that has no effect. If dev compiles are slow, trace them instead:
 *   npm run dev -- --internal-trace
 *   npx next internal trace .next-profiles/trace-turbopack.bin
 */
const nextConfig: NextConfig = {};

export default nextConfig;
