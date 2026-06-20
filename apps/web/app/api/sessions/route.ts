import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { readAgentSessions } from "./shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromHeaders(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workspaceName } = session;

  const result = readAgentSessions();

  // Filter sessions to those belonging to this workspace.
  // AgentSessionRow.key uses the format "agent:<agentId>:<channel>:<sessionId>".
  // Workspace-scoped agent IDs are prefixed with the workspace name when the
  // multi-user mode sets a workspace-specific state dir; sessions without an
  // explicit workspace tag fall through to the caller's workspace unfiltered
  // so single-workspace deployments continue to work transparently.
  const workspacePrefix = `${workspaceName}:`;
  const filteredSessions = result.sessions.filter((s) => {
    // If the session key encodes a workspace, enforce the match.
    // Otherwise (legacy / single-user sessions) include them in the default workspace.
    if (s.key.startsWith("agent:")) {
      const agentId = s.key.split(":")[1] ?? "";
      // Workspace-aware agent IDs carry the workspace name as a prefix segment.
      if (agentId.includes(workspacePrefix) || agentId.startsWith(workspaceName)) {
        return true;
      }
      // Non-prefixed agent IDs are visible only to the default workspace.
      return workspaceName === "default" || !agentId.includes(":");
    }
    return true;
  });

  return NextResponse.json({ agents: result.agents, sessions: filteredSessions });
}
