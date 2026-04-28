import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp-servers", () => {
  class MockMcpServerError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = "McpServerError";
      this.status = status;
    }
  }

  return {
    getMcpServer: vi.fn(),
    getMcpServerConfig: vi.fn(),
    recordServerState: vi.fn(),
    McpServerError: MockMcpServerError,
  };
});

vi.mock("@/lib/mcp-probe", () => ({
  probeMcpServer: vi.fn(),
}));

vi.mock("@/lib/mcp-oauth", () => ({
  buildAuthorizationUrl: vi.fn(),
  discoverOAuthMetadata: vi.fn(),
  McpOAuthError: class MockMcpOAuthError extends Error {
    reason: string;

    constructor(reason: string, message?: string) {
      super(message ?? reason);
      this.name = "McpOAuthError";
      this.reason = reason;
    }
  },
  registerOAuthClient: vi.fn(),
}));

vi.mock("@/lib/mcp-secrets", () => ({
  getMcpServerSecret: vi.fn(),
  setMcpServerSecret: vi.fn(),
}));

vi.mock("@/lib/public-origin", () => ({
  resolveAppPublicOrigin: vi.fn(() => "http://localhost:3100"),
}));

const {
  getMcpServer,
  getMcpServerConfig,
  recordServerState,
} = await import("@/lib/mcp-servers");
const { probeMcpServer } = await import("@/lib/mcp-probe");
const {
  buildAuthorizationUrl,
  discoverOAuthMetadata,
  registerOAuthClient,
} = await import("@/lib/mcp-oauth");
const { getMcpServerSecret, setMcpServerSecret } = await import("@/lib/mcp-secrets");
const { POST } = await import("./route");

const mockedGetMcpServer = vi.mocked(getMcpServer);
const mockedGetMcpServerConfig = vi.mocked(getMcpServerConfig);
const mockedRecordServerState = vi.mocked(recordServerState);
const mockedProbeMcpServer = vi.mocked(probeMcpServer);
const mockedDiscoverOAuthMetadata = vi.mocked(discoverOAuthMetadata);
const mockedRegisterOAuthClient = vi.mocked(registerOAuthClient);
const mockedBuildAuthorizationUrl = vi.mocked(buildAuthorizationUrl);
const mockedGetMcpServerSecret = vi.mocked(getMcpServerSecret);
const mockedSetMcpServerSecret = vi.mocked(setMcpServerSecret);

const serverEntry = {
  key: "acme",
  url: "https://mcp.example.com",
  transport: "streamable-http",
  hasAuth: false,
  state: "needs_auth" as const,
  toolCount: null,
  lastCheckedAt: null,
  lastDetail: null,
};

describe("POST /api/settings/mcp/connect/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMcpServer.mockReturnValue(serverEntry);
    mockedGetMcpServerConfig.mockReturnValue({
      url: "https://mcp.example.com",
      transport: "streamable-http",
    });
  });

  it("validates key field", async () => {
    const response = await POST(new Request("http://localhost/api/settings/mcp/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: 123 }),
    }));

    expect(response.status).toBe(400);
  });

  it("falls back when the server doesn't advertise resource_metadata", async () => {
    mockedProbeMcpServer.mockResolvedValue({
      status: "needs_auth",
      toolCount: null,
      authChallenge: null,
      detail: "HTTP 401 from MCP server.",
      checkedAt: "2026-04-29T00:00:00.000Z",
      httpStatus: 401,
    });

    const response = await POST(new Request("http://localhost/api/settings/mcp/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "acme" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.supportsOAuth).toBe(false);
    expect(body.reason).toMatch(/did not advertise/);
    expect(mockedRecordServerState).toHaveBeenCalledWith("acme", expect.objectContaining({
      state: "needs_auth",
    }));
  });

  it("returns authorizationUrl and persists transient OAuth state on happy path", async () => {
    mockedProbeMcpServer.mockResolvedValue({
      status: "needs_auth",
      toolCount: null,
      authChallenge: {
        scheme: "Bearer",
        realm: null,
        resourceMetadataUrl: "https://mcp.example.com/.well-known/oauth-protected-resource",
        scope: null,
        errorCode: null,
        errorDescription: null,
      },
      detail: "HTTP 401 from MCP server.",
      checkedAt: "2026-04-29T00:00:00.000Z",
      httpStatus: 401,
    });
    mockedDiscoverOAuthMetadata.mockResolvedValue({
      resource: {
        resource: "https://mcp.example.com",
        authorizationServers: ["https://auth.example.com"],
        scopesSupported: ["mcp:read"],
        bearerMethodsSupported: ["header"],
      },
      authServer: {
        issuer: "https://auth.example.com",
        authorizationEndpoint: "https://auth.example.com/authorize",
        tokenEndpoint: "https://auth.example.com/token",
        registrationEndpoint: "https://auth.example.com/register",
        scopesSupported: ["mcp:read"],
        responseTypesSupported: ["code"],
        grantTypesSupported: ["authorization_code"],
        codeChallengeMethodsSupported: ["S256"],
        tokenEndpointAuthMethodsSupported: ["none"],
      },
    });
    mockedGetMcpServerSecret.mockReturnValue(null);
    mockedRegisterOAuthClient.mockResolvedValue({
      clientId: "client-123",
      clientSecret: null,
      registrationAccessToken: null,
      registrationClientUri: null,
    });
    mockedBuildAuthorizationUrl.mockReturnValue({
      authorizationUrl: "https://auth.example.com/authorize?client_id=client-123",
      state: "state-123",
      codeVerifier: "verifier-123",
      redirectUri: "http://localhost:3100/api/settings/mcp/connect/callback",
      scope: "mcp:read",
    });

    const response = await POST(new Request("http://localhost/api/settings/mcp/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "acme" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      supportsOAuth: true,
      authorizationUrl: "https://auth.example.com/authorize?client_id=client-123",
      redirectUri: "http://localhost:3100/api/settings/mcp/connect/callback",
      issuer: "https://auth.example.com",
    });
    expect(mockedSetMcpServerSecret).toHaveBeenCalledWith("acme", expect.objectContaining({
      clientId: "client-123",
      codeVerifier: "verifier-123",
      oauthState: "state-123",
      scope: "mcp:read",
    }));
  });
});
