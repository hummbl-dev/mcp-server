import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub MCP_CONFIG before importing models.ts so that API_CONFIG is read
// with a configured base URL and API key. Without this, the module-level
// API_CONFIG falls back to undefined HUMMBL_API_KEY and the tool handler
// returns the "not configured" isError branch.
vi.mock("../config/mcp.js", () => ({
  MCP_CONFIG: {
    HUMMBL_API_URL: "https://test.example.com",
    HUMMBL_API_KEY: "hummbl_test_12345",
    ENABLE_USAGE_TRACKING: false,
  },
  SERVER_MODE: "hybrid",
  default: {
    HUMMBL_API_URL: "https://test.example.com",
    HUMMBL_API_KEY: "hummbl_test_12345",
    ENABLE_USAGE_TRACKING: false,
  },
}));

import { createMockServer } from "./setup.js";
import { registerModelTools } from "../tools/models.js";

type RecHistoryPayload = {
  count: number;
  limit: number;
  offset: number;
  recommendations: Array<{
    id: string;
    problem: string;
    model_codes: string[];
    top_pattern: string | null;
    created_at: string;
  }>;
};

function mockFetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Internal Server Error",
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
    async json() {
      return body;
    },
  } as unknown as Response;
}

describe("get_recommendation_history tool", () => {
  let mockServer: any;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockServer = createMockServer();
    registerModelTools(mockServer);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the recommendation history payload on a 200 response", async () => {
    const payload: RecHistoryPayload = {
      count: 2,
      limit: 20,
      offset: 0,
      recommendations: [
        {
          id: "r1",
          problem: "scaling onboarding",
          model_codes: ["P1", "IN3"],
          top_pattern: "growth",
          created_at: "2026-04-05T10:00:00Z",
        },
        {
          id: "r2",
          problem: "team structure",
          model_codes: ["CO1"],
          top_pattern: null,
          created_at: "2026-04-05T09:00:00Z",
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(mockFetchResponse(200, payload));

    const tool = mockServer.getTool("get_recommendation_history");
    const result = await tool.handler({});

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(payload);
    expect(result.content[0].text).toContain("scaling onboarding");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toBe("https://test.example.com/v1/recommendations");
    // Authorization header carries the configured API key.
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer hummbl_test_12345");
  });

  it("forwards limit and offset into the query string", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(200, { count: 0, limit: 5, offset: 10, recommendations: [] })
    );

    const tool = mockServer.getTool("get_recommendation_history");
    await tool.handler({ limit: 5, offset: 10 });

    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("offset=10");
  });

  it("returns isError with the API status when fetch resolves non-OK", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(500, "internal boom"));

    const tool = mockServer.getTool("get_recommendation_history");
    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain("500");
    expect(result.content[0].text).toContain("internal boom");
  });

  it("returns isError with a 'Failed to fetch' message when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:8787"));

    const tool = mockServer.getTool("get_recommendation_history");
    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain("Failed to fetch recommendation history");
    expect(result.content[0].text).toContain("ECONNREFUSED");
  });
});
