import {
  getMcpServerConfig,
  McpServerError,
  recordServerState,
} from "@/lib/mcp-servers";
import { probeMcpServer } from "@/lib/mcp-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProbeBody = {
  key?: unknown;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: ProbeBody;
  try {
    body = (await req.json()) as ProbeBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (typeof body.key !== "string") {
    return jsonError("Field 'key' must be a string.", 400);
  }

  let serverConfig;
  try {
    serverConfig = getMcpServerConfig(body.key);
  } catch (err) {
    if (err instanceof McpServerError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(
      err instanceof Error ? err.message : "Failed to load MCP server.",
      500,
    );
  }

  if (!serverConfig) {
    return jsonError(`MCP server '${body.key}' was not found.`, 404);
  }

  const result = await probeMcpServer({
    url: serverConfig.url,
    headers: serverConfig.headers,
  });

  try {
    const entry = recordServerState(body.key, {
      state: result.status,
      toolCount: result.toolCount,
      detail: result.detail,
      checkedAt: result.checkedAt,
    });
    return Response.json({
      server: entry,
      probe: {
        status: result.status,
        toolCount: result.toolCount,
        detail: result.detail,
        checkedAt: result.checkedAt,
        httpStatus: result.httpStatus,
        authChallenge: result.authChallenge,
      },
    });
  } catch (err) {
    if (err instanceof McpServerError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(
      err instanceof Error ? err.message : "Failed to record probe result.",
      500,
    );
  }
}
