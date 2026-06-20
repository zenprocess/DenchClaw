import {
  disconnectComposioApp,
  resolveComposioApiKey,
  resolveComposioEligibility,
  resolveComposioGatewayUrl,
} from "@/lib/composio";
import { refreshIntegrationsRuntime } from "@/lib/integrations";
import { clearConnection, readConnections } from "@/lib/denchclaw-state";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DisconnectRequestBody = {
  connection_id?: unknown;
};

/**
 * Wipe any local `~/.openclaw-dench/.../connections.json` record that
 * points at the just-disconnected Composio connection. Without this,
 * the sync runner keeps re-trying the dead connection every 5 minutes
 * (because `connections.json` still has the stale id), so the
 * `SyncHealthBanner` never clears even after the user disconnects.
 *
 * We compare connection ids strictly — disconnecting one Gmail account
 * doesn't clobber the local record for a different Gmail account that
 * happens to be active.
 */
function clearLocalSyncRecordsFor(
  connectionId: string,
  workspaceName: string,
): {
  clearedGmail: boolean;
  clearedCalendar: boolean;
} {
  const current = readConnections(workspaceName);
  let clearedGmail = false;
  let clearedCalendar = false;
  if (current.gmail?.connectionId === connectionId) {
    clearConnection("gmail", workspaceName);
    clearedGmail = true;
  }
  if (current.calendar?.connectionId === connectionId) {
    clearConnection("calendar", workspaceName);
    clearedCalendar = true;
  }
  return { clearedGmail, clearedCalendar };
}

export async function POST(req: Request) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.role, "composio:write");
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 },
    );
  }

  const apiKey = resolveComposioApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Dench Cloud API key is required." },
      { status: 403 },
    );
  }

  const eligibility = resolveComposioEligibility();
  if (!eligibility.eligible) {
    return Response.json(
      {
        error: "Dench Cloud must be the primary provider.",
        lockReason: eligibility.lockReason,
        lockBadge: eligibility.lockBadge,
      },
      { status: 403 },
    );
  }

  let body: DisconnectRequestBody;
  try {
    body = (await req.json()) as DisconnectRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.connection_id !== "string" || !body.connection_id.trim()) {
    return Response.json(
      { error: "Field 'connection_id' must be a non-empty string." },
      { status: 400 },
    );
  }

  const gatewayUrl = resolveComposioGatewayUrl();
  const connectionId = body.connection_id.trim();

  try {
    const data = await disconnectComposioApp(gatewayUrl, apiKey, connectionId);
    // Both real disconnects and `alreadyGone` 404s clear the local
    // record — the upstream truth is "this id is dead", so any local
    // pointer to it is stale. Scoped to session.workspaceName so a user
    // can only clear records in their own workspace.
    const localCleanup = clearLocalSyncRecordsFor(connectionId, session.workspaceName);
    const refresh = await refreshIntegrationsRuntime();
    return Response.json({
      ...data,
      local_cleanup: localCleanup,
      runtime_refresh: refresh,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect." },
      { status: 502 },
    );
  }
}
