import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMethodologyTools } from "./methodology.js";

type ToolHandler = (input?: unknown) => Promise<unknown>;

vi.mock("../framework/self_dialectical.js", () => {
  const getSelfDialecticalMethodology = vi.fn();
  const auditModelCodes = vi.fn();
  return {
    getSelfDialecticalMethodology,
    auditModelCodes,
  };
});

const { getSelfDialecticalMethodology, auditModelCodes } = await import(
  "../framework/self_dialectical.js"
);

// Type assertions for mocked functions - cast to any to allow mock methods
const mockedGetMethodology = getSelfDialecticalMethodology as any;
const mockedAuditCodes = auditModelCodes as any;

describe("registerMethodologyTools", () => {
  let server: McpServer;
  let registeredHandlers: Record<string, ToolHandler>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "1.0.0" });
    registeredHandlers = {};

    (vi.spyOn(server, "registerTool") as any).mockImplementation(
      (name: any, _config: any, handler: any) => {
        registeredHandlers[name] = handler as unknown as ToolHandler;
        return server;
      }
    );

    mockedGetMethodology.mockReset();
    mockedAuditCodes.mockReset();
    registerMethodologyTools(server);
  });

  it("returns methodology payload when source succeeds", async () => {
    const methodology = {
      id: "meth",
      title: "Self Dialectical",
      version: "1.0",
      summary: "",
      modelsReferenced: [],
      stages: [],
      metaModels: [],
    };
    mockedGetMethodology.mockReturnValue({ ok: true, value: methodology });

    const handler = registeredHandlers["get_methodology"];
    const response = (await handler()) as {
      content: Array<{ text: string }>;
      structuredContent: unknown;
    };

    expect(JSON.parse(response.content[0].text)).toEqual(methodology);
    expect(response.structuredContent).toEqual(methodology);
  });

  it("returns error content when methodology lookup fails", async () => {
    mockedGetMethodology.mockReturnValue({
      ok: false,
      error: { type: "Internal", message: "boom" },
    });

    const handler = registeredHandlers["get_methodology"];
    const response = (await handler()) as { isError?: boolean };

    expect(response.isError).toBe(true);
  });

  it("audits model references successfully", async () => {
    const auditResult = {
      methodologyId: "meth",
      documentVersion: "1.0",
      totalReferences: 1,
      validCount: 1,
      invalidCount: 0,
      issues: [],
    };
    mockedAuditCodes.mockReturnValue({ ok: true, value: auditResult });

    const handler = registeredHandlers["audit_model_references"];
    const response = (await handler({ items: [{ code: "P1" }] })) as { structuredContent: unknown };

    expect(response.structuredContent).toEqual(auditResult);
  });

  it("surface audit errors with validation details", async () => {
    mockedAuditCodes.mockReturnValue({
      ok: false,
      error: { type: "ValidationError", message: "bad input" },
    });

    const handler = registeredHandlers["audit_model_references"];
    const response = (await handler({ items: [{ code: "INVALID" }] })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("bad input");
  });

  it("surfaces audit errors for non-validation failures", async () => {
    mockedAuditCodes.mockReturnValue({ ok: false, error: { type: "Internal", message: "boom" } });

    const handler = registeredHandlers["audit_model_references"];
    const response = (await handler({ items: [{ code: "P1" }] })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Unable to audit model references");
  });

  it("handles expected transformation validation", async () => {
    mockedAuditCodes.mockReturnValue({
      ok: true,
      value: {
        methodologyId: "meth",
        documentVersion: "1.0",
        totalReferences: 1,
        validCount: 0,
        invalidCount: 1,
        issues: [
          {
            code: "P1",
            issueType: "WrongTransformation",
            message: "Mismatch",
            expectedTransformation: "IN",
            actualTransformation: "P",
          },
        ],
      },
    });

    const handler = registeredHandlers["audit_model_references"];
    const response = (await handler({ items: [{ code: "P1", expectedTransformation: "IN" }] })) as {
      structuredContent: {
        issues: Array<{ expectedTransformation?: string; actualTransformation?: string }>;
      };
    };

    expect(response.structuredContent.issues[0].expectedTransformation).toBe("IN");
    expect(response.structuredContent.issues[0].actualTransformation).toBe("P");
  });
});
