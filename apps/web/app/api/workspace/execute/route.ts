import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveDuckdbBin, resolveWorkspaceDirForName } from "@/lib/workspace";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const BLOCKED_PATTERN =
  /^\s*(DROP\s+DATABASE|ATTACH|DETACH|COPY|EXPORT|INSTALL|LOAD|PRAGMA|\.)/i;

/**
 * Run a SQL query against the DuckDB file for a specific workspace.
 * Mirrors the retry logic in `duckdbQueryAsync` but scoped to the provided
 * workspace DB path rather than the globally-active workspace.
 */
async function duckdbQueryScoped<T = Record<string, unknown>>(
  db: string,
  sql: string,
): Promise<T[]> {
  const bin = resolveDuckdbBin();
  if (!bin) { return []; }

  const MAX_RETRIES = 8;
  let attempt = 0;
  let lastErr = "";
  while (attempt < MAX_RETRIES) {
    try {
      const { stdout } = await execFileAsync(bin, ["-json", db, sql], {
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const trimmed = stdout.trim();
      if (!trimmed || trimmed === "[]") { return []; }
      return JSON.parse(trimmed) as T[];
    } catch (err) {
      const stderr = (err as { stderr?: string | Buffer }).stderr;
      const stderrText =
        typeof stderr === "string"
          ? stderr
          : Buffer.isBuffer(stderr)
            ? stderr.toString("utf-8")
            : (err as Error).message ?? "";
      lastErr = stderrText.slice(0, 600);
      const lockConflict =
        stderrText.includes("Conflicting lock") ||
        stderrText.includes("Could not set lock");
      if (!lockConflict) { return []; }
      const delay = Math.min(4000, 250 * 2 ** attempt) + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
  console.error(`[duckdb:execute] gave up after ${MAX_RETRIES} retries: ${lastErr}`);
  return [];
}

export async function POST(req: Request) {
  // --- Auth: require a valid session ---
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- RBAC: viewers are denied; only members and admins may execute SQL ---
  try {
    requirePermission(session.role, "workspace:write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sql?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sql } = body;
  if (!sql || typeof sql !== "string") {
    return Response.json(
      { error: "Missing 'sql' field in request body" },
      { status: 400 },
    );
  }

  if (BLOCKED_PATTERN.test(sql)) {
    return Response.json(
      { error: "This SQL statement is not allowed" },
      { status: 403 },
    );
  }

  // --- Scope: resolve the DB file for the session's workspace ---
  const workspaceDir = resolveWorkspaceDirForName(session.workspaceName);
  const db = join(workspaceDir, "workspace.duckdb");
  if (!existsSync(db)) {
    return Response.json(
      { error: "Workspace database not found" },
      { status: 404 },
    );
  }

  try {
    const rows = await duckdbQueryScoped(db, sql);
    return Response.json({ rows: rows ?? [], ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 },
    );
  }
}
