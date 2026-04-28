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
    getMcpServerConfig: vi.fn(),
    recordServerState: vi.fn(),
    McpServerError: MockMcpServerError,
  };
});

vi.mock("@/lib/mcp-probe", () => ({
  probeMcpServer: vi.fn(),
}));

const {
  getMcpServerConfig,
  McpServerError,
  recordServerState,
} = await import("@/lib/mcp-servers");
const { probeMcpServer } = await import("@/lib/mcp-probe");
const { POST } = await import("./route");

const mockedGetMcpServerConfig = vi.mocked(getMcpServerConfig);
const mockedProbeMcpServer = vi.mocked(probeMcpServer);
const mockedRecordServerState = vi.mocked(recordServerState);

describe("POST /api/settings/mcp/probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates key field", async () => {
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: 123 }),
    }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the server doesn't exist", async () => {
    mockedGetMcpServerConfig.mockReturnValue(null);
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "missing" }),
    }));
    expect(response.status).toBe(404);
  });

  it("propagates McpServerError status from getMcpServerConfig", async () => {
    mockedGetMcpServerConfig.mockImplementation(() => {
      throw new McpServerError(400, "Field 'key' must use only letters, numbers, hyphens, or underscores.");
    });
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "bad key" }),
    }));
    expect(response.status).toBe(400);
  });

  it("probes and records state on success", async () => {
    mockedGetMcpServerConfig.mockReturnValue({
      url: "https://mcp.example.com",
      transport: "streamable-http",
      headers: { Authorization: "Bearer abc" },
    });
    mockedProbeMcpServer.mockResolvedValue({
      status: "connected",
      toolCount: 4,
      authChallenge: null,
      detail: "Connected. 4 tools available.",
      checkedAt: "2026-04-29T00:00:00.000Z",
      httpStatus: 200,
    });
    mockedRecordServerState.mockReturnValue({
      key: "acme",
      url: "https://mcp.example.com",
      transport: "streamable-http",
      hasAuth: true,
      state: "connected",
      toolCount: 4,
      lastCheckedAt: "2026-04-29T00:00:00.000Z",
      lastDetail: "Connected. 4 tools available.",
    });

    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "acme" }),
    }));
    const body = await response.json();

    expect(mockedProbeMcpServer).toHaveBeenCalledWith({
      url: "https://mcp.example.com",
      headers: { Authorization: "Bearer abc" },
    });
    expect(mockedRecordServerState).toHaveBeenCalledWith("acme", {
      state: "connected",
      toolCount: 4,
      detail: "Connected. 4 tools available.",
      checkedAt: "2026-04-29T00:00:00.000Z",
    });
    expect(response.status).toBe(200);
    expect(body.server).toMatchObject({ state: "connected", toolCount: 4 });
    expect(body.probe.status).toBe("connected");
  });
});
