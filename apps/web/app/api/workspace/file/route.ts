import { writeFileSync, mkdirSync, rmSync, statSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";
import {
  readWorkspaceFile,
  safeResolvePath,
  resolveFilesystemPath,
  isProtectedSystemPath,
  findDuckDBForObjectAsync,
  duckdbPathAsync,
  duckdbExecOnFileAsync,
  pivotViewIdentifier,
  resolveWorkspaceDirForName,
} from "@/lib/workspace";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * For non-admin sessions, verify that an absolute path is contained within
 * the session's own workspace directory. Admins may access any path that
 * passes the existing workspace/home guards.
 */
function assertWithinSessionWorkspace(
  absolutePath: string,
  workspaceName: string,
): boolean {
  const wsDir = resolve(resolveWorkspaceDirForName(workspaceName));
  return absolutePath === wsDir || absolutePath.startsWith(wsDir + "/");
}

export async function GET(req: Request) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return Response.json(
      { error: "Missing 'path' query parameter" },
      { status: 400 },
    );
  }

  // Scope non-admins to their own workspace by validating the resolved path.
  if (session.role !== "admin") {
    const resolved = resolveFilesystemPath(path);
    if (
      !resolved ||
      !assertWithinSessionWorkspace(resolved.absolutePath, session.workspaceName)
    ) {
      return Response.json(
        { error: "File not found or access denied" },
        { status: 404 },
      );
    }
  }

  const file = readWorkspaceFile(path);
  if (!file) {
    return Response.json(
      { error: "File not found or access denied" },
      { status: 404 },
    );
  }

  return Response.json(file);
}

/**
 * POST /api/workspace/file
 * Body: { path: string, content: string }
 *
 * Writes a file to the workspace. Creates parent directories as needed.
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

  let body: { path?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { path: relPath, content } = body;
  if (!relPath || typeof relPath !== "string" || typeof content !== "string") {
    return Response.json(
      { error: "Missing 'path' and 'content' fields" },
      { status: 400 },
    );
  }

  const targetPath = resolveFilesystemPath(relPath, { allowMissing: true });
  if (isProtectedSystemPath(targetPath)) {
    return Response.json(
      { error: "Cannot modify system file" },
      { status: 403 },
    );
  }

  if (!targetPath) {
    return Response.json(
      { error: "Invalid path or path traversal rejected" },
      { status: 400 },
    );
  }

  // Scope non-admins to their own workspace.
  if (
    session.role !== "admin" &&
    !assertWithinSessionWorkspace(targetPath.absolutePath, session.workspaceName)
  ) {
    return Response.json(
      { error: "Invalid path or path traversal rejected" },
      { status: 400 },
    );
  }

  try {
    mkdirSync(dirname(targetPath.absolutePath), { recursive: true });
    writeFileSync(targetPath.absolutePath, content, "utf-8");
    return Response.json({ ok: true, path: relPath });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}

async function dropObjectPivotViewForDeletedFolder(absPath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const yamlPath = join(absPath, ".object.yaml");
  if (!existsSync(yamlPath)) {
    return { ok: true };
  }

  let objectName: string | null = null;
  try {
    const parsed = YAML.parse(readFileSync(yamlPath, "utf-8")) as { name?: unknown } | null;
    objectName = typeof parsed?.name === "string" ? parsed.name.trim() : null;
  } catch {
    objectName = null;
  }

  if (!objectName) {
    return { ok: true };
  }

  const dbFile = await findDuckDBForObjectAsync(objectName) ?? await duckdbPathAsync();
  if (!dbFile) {
    return { ok: true };
  }

  const dropped = await duckdbExecOnFileAsync(
    dbFile,
    `DROP VIEW IF EXISTS ${pivotViewIdentifier(objectName)};`,
  );
  if (!dropped) {
    return { ok: false, error: `Failed to delete pivot view for object '${objectName}'.` };
  }

  return { ok: true };
}

/**
 * DELETE /api/workspace/file
 * Body: { path: string }
 *
 * Deletes a file or folder from the workspace.
 * System files (.object.yaml, workspace.duckdb, etc.) are protected.
 */
export async function DELETE(req: Request) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.role, "workspace:write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { path: relPath } = body;
  if (!relPath || typeof relPath !== "string") {
    return Response.json(
      { error: "Missing 'path' field" },
      { status: 400 },
    );
  }

  const targetPath = resolveFilesystemPath(relPath);
  if (isProtectedSystemPath(targetPath)) {
    return Response.json(
      { error: "Cannot delete system file" },
      { status: 403 },
    );
  }

  const absPath = targetPath?.absolutePath ?? safeResolvePath(relPath);
  if (!absPath) {
    return Response.json(
      { error: "File not found or path traversal rejected" },
      { status: 404 },
    );
  }

  // Scope non-admins to their own workspace.
  if (
    session.role !== "admin" &&
    !assertWithinSessionWorkspace(absPath, session.workspaceName)
  ) {
    return Response.json(
      { error: "File not found or path traversal rejected" },
      { status: 404 },
    );
  }

  try {
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      const pivotDelete = await dropObjectPivotViewForDeletedFolder(absPath);
      if (!pivotDelete.ok) {
        return Response.json({ error: pivotDelete.error }, { status: 500 });
      }
    }
    rmSync(absPath, { recursive: stat.isDirectory() });
    return Response.json({ ok: true, path: relPath });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}
