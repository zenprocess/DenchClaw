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

  // Forward session identity to route handlers via the REQUEST headers so
  // getSessionFromHeaders(request.headers) can read them. Setting them on the
  // response would only expose them to the browser, never to the handlers —
  // which would make every authenticated request 401. (Classic Next.js trap.)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-workspace-name", session.workspaceName);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on all paths except Next.js internals and static files.
  // The PUBLIC_PATHS check inside the function body handles the
  // /login and /api/auth allowlist.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
