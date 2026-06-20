import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { trackServer } from "@/lib/telemetry";
import { type WebSessionMeta, ensureDir, readIndex, writeIndex } from "./shared";
import {
  resolveActiveAgentId,
  resolveWorkspaceDirForName,
  resolveWorkspaceRoot,
} from "@/lib/workspace";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth/session";

export { type WebSessionMeta };

export const dynamic = "force-dynamic";

/** GET /api/web-sessions — list web chat sessions.
 *  ?filePath=... → returns only sessions scoped to that file.
 *  ?includeAll=true → returns all sessions (including file-scoped).
 *  No filePath   → returns only global (non-file) sessions. */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workspaceName } = session;

  const url = new URL(req.url);
  const filePath = url.searchParams.get("filePath");
  const includeAll = url.searchParams.get("includeAll") === "true";

  // Retrieve all sessions and filter to this workspace first, then apply
  // the filePath / includeAll filters on top.
  const all = readIndex().filter(
    (s) => !s.workspaceName || s.workspaceName === workspaceName,
  );
  const sessions = includeAll
    ? all
    : filePath
      ? all.filter((s) => s.filePath === filePath)
      : all.filter((s) => !s.filePath);

  return NextResponse.json({ sessions });
}

/** POST /api/web-sessions — create a new web chat session */
export async function POST(req: NextRequest) {
  const authSession = getSessionFromHeaders(req.headers);
  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workspaceName } = authSession;

  const body = await req.json().catch(() => ({}));
  const id = randomUUID();
  const now = Date.now();

  const workspaceRoot = resolveWorkspaceRoot() ?? resolveWorkspaceDirForName(workspaceName);
  const workspaceAgentId = resolveActiveAgentId();
  const gatewaySessionKey = `agent:${workspaceAgentId}:web:${id}`;

  const session: WebSessionMeta = {
    id,
    title: body.title || "New Chat",
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...(body.filePath ? { filePath: body.filePath } : {}),
    workspaceName: workspaceName || undefined,
    workspaceRoot,
    workspaceAgentId,
    gatewaySessionKey,
    agentMode: "workspace",
    lastActiveAt: now,
  };

  const sessions = readIndex();
  sessions.unshift(session);
  writeIndex(sessions);

  const dir = ensureDir();
  writeFileSync(`${dir}/${id}.jsonl`, "");

  trackServer("session_created");

  return Response.json({ session });
}
