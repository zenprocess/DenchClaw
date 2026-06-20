import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { resolveWorkspaceDirForName } from "@/lib/workspace";
import { trackServer } from "@/lib/telemetry";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/workspace/upload
 * Accepts multipart form data with a "file" field.
 * Saves to assets/<timestamp>-<filename> inside the session's workspace.
 * Returns { ok, path } where path is workspace-relative.
 */
export async function POST(req: Request) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.role, "workspace:write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve the workspace root scoped to the authenticated user's workspace.
  // Admins upload to their own workspace (session.workspaceName); cross-workspace
  // uploads are not supported through this endpoint.
  let root: string;
  try {
    root = resolve(resolveWorkspaceDirForName(session.workspaceName));
  } catch {
    return Response.json(
      { error: "Workspace not found" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: "Missing 'file' field" },
      { status: 400 },
    );
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "File is too large (max 25 MB)" },
      { status: 400 },
    );
  }

  // Build a safe filename: timestamp + sanitized original name
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
  const relPath = join("assets", `${Date.now()}-${safeName}`);

  // Validate that the resolved absolute path stays within the workspace root.
  const absPath = resolve(root, relPath);
  if (!absPath.startsWith(root + "/")) {
    return Response.json(
      { error: "Invalid path" },
      { status: 400 },
    );
  }

  try {
    mkdirSync(dirname(absPath), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(absPath, buffer);
    trackServer("file_uploaded");
    return Response.json({ ok: true, path: relPath });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
