import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets — pass through immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Auth endpoints and login page — always public
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await verifySession(request);

  if (!session) {
    // API callers get a machine-readable 401; browser navigation gets redirected
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Forward session identity to route handlers via request headers so they
  // don't need to re-verify the cookie.
  const response = NextResponse.next();
  response.headers.set("x-user-id", session.userId);
  response.headers.set("x-user-role", session.role);
  response.headers.set("x-workspace-name", session.workspaceName);
  return response;
}

export const config = {
  // Run on all paths except Next.js internals and static files.
  // The PUBLIC_PATHS check inside the function body handles the
  // /login and /api/auth allowlist.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
