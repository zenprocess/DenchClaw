import {
  readOnboardingState,
  writeConnection,
  writeOnboardingState,
  type ConnectionRecord,
} from "@/lib/denchclaw-state";
import type { NormalizedComposioConnection } from "@/lib/composio";

export function syncToolkitFromConnection(
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

export function persistLocalSyncConnection(connection: NormalizedComposioConnection): void {
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
  writeConnection(toolkit, record);

  const current = readOnboardingState();
  writeOnboardingState({
    ...current,
    connections: {
      ...current.connections,
      [toolkit]: record,
    },
  });
}
