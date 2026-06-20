import {
  fetchComposioConnections,
  initiateComposioConnect,
  resolveComposioApiKey,
  resolveComposioGatewayUrl,
} from "@/lib/composio";
import {
  extractComposioConnections,
  normalizeComposioConnections,
  normalizeComposioToolkitSlug,
} from "@/lib/composio-client";
import {
  readOnboardingState,
  writeConnection,
  writeOnboardingState,
  type ConnectionRecord,
} from "@/lib/denchclaw-state";
import { resolveComposioConnectToolkitSlug } from "@/lib/composio-normalization";
import { resolveAppPublicOrigin } from "@/lib/public-origin";
import type { NormalizedComposioConnection } from "@/lib/composio";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConnectRequestBody = {
  toolkit?: unknown;
};

function syncToolkitFromConnection(
  connection: NormalizedComposioConnection,
): "gmail" | "calendar" | null {
  if (connection.normalized_toolkit_slug === "gmail") {
    return "gmail";
  }
  if (
    connection.normalized_toolkit_slug === "google-calendar" ||
    connection.normalized_toolkit_slug === "googlecalendar"
  ) {
    return "calendar";
  }
  return null;
}

function persistLocalSyncConnection(
  connection: NormalizedComposioConnection,
  workspaceName: string,
): void {
  if (!connection.is_active) {
    return;
  }
  const toolkit = syncToolkitFromConnection(connection);
  if (!toolkit) {
    return;
  }

  const record: ConnectionRecord = {
    connectionId: connection.id,
    toolkitSlug: connection.normalized_toolkit_slug,
    accountEmail: connection.account_email ?? connection.account?.email ?? undefined,
    accountLabel: connection.display_label,
    connectedAt: new Date().toISOString(),
  };
  writeConnection(toolkit, record, workspaceName);

  const current = readOnboardingState(workspaceName);
  writeOnboardingState({
    ...current,
    connections: {
      ...current.connections,
      [toolkit]: record,
    },
  }, workspaceName);
}

export async function POST(request: Request) {
  const session = getSessionFromHeaders(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workspaceName, role } = session;

  try {
    requirePermission(role, "composio:write");
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const apiKey = resolveComposioApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Composio API key is required." },
      { status: 403 },
    );
  }

  let body: ConnectRequestBody;
  try {
    body = (await request.json()) as ConnectRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.toolkit !== "string" || !body.toolkit.trim()) {
    return Response.json(
      { error: "Field 'toolkit' must be a non-empty string." },
      { status: 400 },
    );
  }

  const origin = resolveAppPublicOrigin(request);
  const callbackUrl = `${origin}/api/composio/callback`;
  const gatewayUrl = resolveComposioGatewayUrl();
  const requestedToolkit = body.toolkit.trim();
  const connectToolkit = resolveComposioConnectToolkitSlug(requestedToolkit);
  const normalizedToolkit = normalizeComposioToolkitSlug(connectToolkit);

  try {
    const activeConnection = normalizeComposioConnections(
      extractComposioConnections(await fetchComposioConnections(gatewayUrl, apiKey)),
    ).find((connection) => connection.normalized_toolkit_slug === normalizedToolkit && connection.is_active);

    if (activeConnection) {
      persistLocalSyncConnection(activeConnection, workspaceName);
      return Response.json({
        already_connected: true,
        connection_id: activeConnection.id,
        connected_account_id: activeConnection.id,
        requested_toolkit: requestedToolkit,
        connect_toolkit: connectToolkit,
        toolkit: normalizedToolkit,
        connected_toolkit_slug: activeConnection.normalized_toolkit_slug,
        connected_toolkit_name: activeConnection.toolkit_name,
        account_email: activeConnection.account_email ?? activeConnection.account?.email ?? null,
        account_label: activeConnection.display_label,
      });
    }

    const data = await initiateComposioConnect(
      gatewayUrl,
      apiKey,
      connectToolkit,
      callbackUrl,
    );
    return Response.json({
      ...data,
      requested_toolkit: requestedToolkit,
      connect_toolkit: connectToolkit,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to initiate connection." },
      { status: 502 },
    );
  }
}
