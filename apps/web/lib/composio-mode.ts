/**
 * Native Composio mode resolver.
 *
 * Three mutually-exclusive modes, checked in priority order:
 *   1. 'native'     — COMPOSIO_API_KEY is set → talk directly to Composio's APIs
 *   2. 'dench-cloud' — DENCH_CLOUD_API_KEY or DENCH_API_KEY is set → route through Dench gateway
 *   3. 'none'       — neither key present → Composio features are unavailable
 */

export type ComposioMode = "native" | "dench-cloud" | "none";

const NATIVE_COMPOSIO_BASE_URL = "https://backend.composio.dev";
const NATIVE_COMPOSIO_MCP_BASE_URL = "https://mcp.composio.dev";
const DENCH_CLOUD_GATEWAY_URL = "https://gateway.merseoriginals.com";

export function resolveComposioMode(): ComposioMode {
  if (process.env.COMPOSIO_API_KEY?.trim()) {
    return "native";
  }
  if (process.env.DENCH_CLOUD_API_KEY?.trim() || process.env.DENCH_API_KEY?.trim()) {
    return "dench-cloud";
  }
  return "none";
}

/**
 * Resolves the active Composio API key.
 *
 * Priority: COMPOSIO_API_KEY → DENCH_CLOUD_API_KEY → DENCH_API_KEY
 */
export function resolveComposioApiKey(): string | null {
  if (process.env.COMPOSIO_API_KEY?.trim()) {
    return process.env.COMPOSIO_API_KEY.trim();
  }
  if (process.env.DENCH_CLOUD_API_KEY?.trim()) {
    return process.env.DENCH_CLOUD_API_KEY.trim();
  }
  if (process.env.DENCH_API_KEY?.trim()) {
    return process.env.DENCH_API_KEY.trim();
  }
  return null;
}

/**
 * Returns the appropriate Composio base URL for the current mode.
 *
 * - native      → https://backend.composio.dev
 * - dench-cloud → https://gateway.merseoriginals.com (or DENCH_GATEWAY_URL override)
 * - none        → Dench gateway URL (fallback; callers should check mode first)
 */
export function resolveComposioBaseUrl(): string {
  const mode = resolveComposioMode();
  if (mode === "native") {
    return NATIVE_COMPOSIO_BASE_URL;
  }
  return process.env.DENCH_GATEWAY_URL?.trim() || DENCH_CLOUD_GATEWAY_URL;
}

export type ComposioMcpConfig = {
  url: string;
  headers: Record<string, string>;
};

/**
 * Builds the MCP server configuration for the given API key.
 *
 * - native mode: points at https://mcp.composio.dev/<key> with x-composio-api-key header
 * - dench-cloud mode: points at the Dench gateway /v1/composio/mcp with Authorization: Bearer header
 */
export function buildComposioMcpConfig(key: string): ComposioMcpConfig {
  const mode = resolveComposioMode();
  if (mode === "native") {
    return {
      url: `${NATIVE_COMPOSIO_MCP_BASE_URL}/${key}`,
      headers: {
        "x-composio-api-key": key,
      },
    };
  }
  const gatewayUrl = process.env.DENCH_GATEWAY_URL?.trim() || DENCH_CLOUD_GATEWAY_URL;
  return {
    url: `${gatewayUrl}/v1/composio/mcp`,
    headers: {
      Authorization: `Bearer ${key}`,
    },
  };
}
