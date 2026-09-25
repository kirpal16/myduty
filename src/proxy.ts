import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed Middleware to Proxy (same mechanism, new file/export
 * name) — see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 *
 * This does an *optimistic* auth check only: authenticated vs not.
 * PENDING/APPROVED/REJECTED status lives in public.users, not the auth
 * session, so it can't be checked here without a DB round trip on every
 * request (including prefetches) — that check belongs in
 * src/app/(protected)/layout.tsx instead, per the Next.js authentication
 * guide's guidance to keep Proxy checks cheap and do the real enforcement
 * close to the data source.
 *
 * Note: unlike the generic Next.js example (which decodes a local
 * encrypted cookie with no network call), this calls supabase.auth.getUser()
 * — Supabase's own guidance is that getSession() reads unvalidated JWT
 * claims straight from the cookie and must never be trusted server-side,
 * while getUser() revalidates the token against the Auth server. That
 * network cost is the accepted tradeoff for a correct check here.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/duty",
  "/calendar",
  "/leave",
  "/holidays",
  "/storage",
  "/reports",
  "/admin",
];
const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

/**
 * The layout needs to know which path is rendering so it can do role-based
 * routing (see lib/permissions/routeAccess). Next does not expose the
 * pathname to a Server Component, so Proxy stamps it on the request headers —
 * the documented way to pass request context down. This stays a pure
 * pass-through: no role logic and no DB read happen here.
 */
export const PATHNAME_HEADER = "x-pathname";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname);

  if (!user && (isProtected || pathname === "/pending-approval")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthOnly) {
    // Optimistic — the (protected) layout re-checks APPROVED status and
    // bounces to /pending-approval if this guess was wrong.
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * sw.js and the manifest are excluded deliberately, not just for speed.
     *
     * Every request that reaches this Proxy costs a supabase.auth.getUser()
     * round trip — ~270ms — and the service worker script is re-fetched on
     * navigation and on every update check. Neither file is protected, and
     * neither means anything different to a signed-in officer, so paying for
     * an auth check on them only delayed how quickly a new version was
     * discovered.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
