import { normalizeLockedDenchIntegrations } from "@/lib/integrations";
import { getSessionFromHeaders } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = getSessionFromHeaders(new Headers(req.headers));
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Integration state is global OpenClaw config — admins only.
  if (session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return Response.json(normalizeLockedDenchIntegrations().state);
}
