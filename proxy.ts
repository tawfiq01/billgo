import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ADMIN_ROLES, REPORT_ROLES } from "@/lib/constants";

// Next.js 16 renamed middleware.ts -> proxy.ts, which runs on the Node.js
// runtime by default (the legacy middleware.ts convention is Edge-only and
// can't reach our SQLite/libSQL file — see lib/db.ts). That lets this query
// Prisma directly for the user's current role/status rather than trusting a
// possibly-stale JWT claim. Coarse-grained route gating only —
// pages/actions re-check ownership and stage-specific permissions
// server-side regardless.
export const config = {
  // Excludes Next internals plus any request for a static asset file (logo,
  // icons, etc. under public/) by extension — those must be servable
  // without a session (e.g. the logo on the login page itself).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const user = await getSessionUserFromToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/reports") && !REPORT_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}
