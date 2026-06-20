import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defense in depth: NEVER trust inbound x-user-* headers. Strip them on EVERY
  // path (static, public, and authenticated) before doing anything else, so a
  // client can never smuggle identity (e.g. x-user-role: admin) to a route
  // handler — including future routes that read getSessionFromHeaders.
  const headers = new Headers(request.headers);
  headers.delete("x-user-id");
  headers.delete("x-user-role");
  headers.delete("x-workspace-name");
  const passThrough = () => NextResponse.next({ request: { headers } });

  // Static assets — pass through with sanitized headers
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return passThrough();
  }

  // Auth endpoints and login page — public, but still header-sanitized
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return passThrough();
  }

  const session = await verifySession(request);

  if (!session) {
    // API callers get a machine-readable 401; browser navigation gets redirected
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Centralized RBAC net (defense in depth + broad coverage for routes the
  // per-route enforcement pass has not reached). Handlers may still enforce
  // finer-grained checks; this guarantees no viewer can mutate and no
  // non-admin can touch user management or global credentials on ANY route.
  if (pathname.startsWith("/api/")) {
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    const adminOnly = /^\/api\/(users|settings\/cloud)(\/|$)/.test(pathname);
    const viewerWriteDenied =
      /^\/api\/(workspace|skills|composio|chat|gateway\/chat|crm|integrations|settings\/mcp)(\/|$)/.test(pathname);
    if (adminOnly && session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (viewerWriteDenied && isWrite && session.role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Forward verified session identity to route handlers via the REQUEST headers
  // (NextResponse.next({ request: { headers } })). Setting them on the response
  // would only expose them to the browser, never to the handlers — which would
  // make every authenticated request 401. These overwrite the (already-stripped)
  // inbound values, so forgery is impossible.
  headers.set("x-user-id", session.userId);
  headers.set("x-user-role", session.role);
  headers.set("x-workspace-name", session.workspaceName);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on all paths except Next.js internals and static files.
  // The PUBLIC_PATHS check inside the function body handles the
  // /login and /api/auth allowlist.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
