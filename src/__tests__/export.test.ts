import { describe, it, expect, beforeEach } from "vitest";
import { createMockServer } from "./setup.js";
import { registerExportTools } from "../tools/export.js";

describe("export_models tool", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockServer: any;

  beforeEach(() => {
    mockServer = createMockServer();
    registerExportTools(mockServer);
  });

  it("registers export_models", () => {
    expect(mockServer.getTool("export_models")).toBeDefined();
  });

  it("exports all 120 models as JSON when no filter is given", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({ format: "json" });
    expect(result.structuredContent.format).toBe("json");
    expect(result.structuredContent.modelCount).toBe(120);
    expect(result.structuredContent.missingCodes).toEqual([]);
    const parsed = JSON.parse(result.structuredContent.content);
    expect(parsed.framework).toBe("HUMMBL Base120");
    expect(parsed.count).toBe(120);
    expect(parsed.models).toHaveLength(120);
    // Sample model carries required fields.
    expect(parsed.models[0]).toHaveProperty("code");
    expect(parsed.models[0]).toHaveProperty("name");
    expect(parsed.models[0]).toHaveProperty("transformation");
  });

  it("exports only the requested codes when `codes` is given", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      codes: ["P1", "IN3", "CO5"],
    });
    expect(result.structuredContent.modelCount).toBe(3);
    expect(result.structuredContent.missingCodes).toEqual([]);
    const parsed = JSON.parse(result.structuredContent.content);
    const codes = parsed.models.map((m: { code: string }) => m.code);
    expect(codes).toEqual(expect.arrayContaining(["P1", "IN3", "CO5"]));
    expect(codes).toHaveLength(3);
  });

  it("reports missing codes without failing", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      codes: ["P1", "ZZ99", "XX42"],
    });
    expect(result.structuredContent.modelCount).toBe(1);
    expect(result.structuredContent.missingCodes).toEqual(["ZZ99", "XX42"]);
  });

  it("accepts lowercase codes and returns uppercase in missingCodes", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      codes: ["p1", "zz99"],
    });
    expect(result.structuredContent.modelCount).toBe(1);
    expect(result.structuredContent.missingCodes).toEqual(["ZZ99"]);
  });

  it("filters by transformation when `transformation` is given", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      transformation: "P",
    });
    expect(result.structuredContent.modelCount).toBeGreaterThan(0);
    const parsed = JSON.parse(result.structuredContent.content);
    for (const m of parsed.models) {
      expect(m.transformation).toBe("P");
    }
  });

  it("treats `codes: []` as an explicit empty filter, not a fall-through", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      codes: [],
      transformation: "P", // must NOT be consulted when codes is provided
    });
    // Explicit empty list → zero models exported, no missing codes.
    expect(result.structuredContent.modelCount).toBe(0);
    expect(result.structuredContent.missingCodes).toEqual([]);
    const parsed = JSON.parse(result.structuredContent.content);
    expect(parsed.count).toBe(0);
    expect(parsed.models).toEqual([]);
  });

  it("returns 0 models for an invalid transformation key", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      transformation: "XX",
    });
    expect(result.structuredContent.modelCount).toBe(0);
  });

  it("codes filter takes precedence over transformation", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "json",
      codes: ["P1"],
      transformation: "IN", // ignored
    });
    expect(result.structuredContent.modelCount).toBe(1);
    const parsed = JSON.parse(result.structuredContent.content);
    expect(parsed.models[0].code).toBe("P1");
    expect(parsed.models[0].transformation).toBe("P");
  });

  it("renders markdown with a heading, count, and transformation sections", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "markdown",
      codes: ["P1", "IN3"],
    });
    const md = result.structuredContent.content as string;
    expect(md).toContain("# HUMMBL Base120 Export");
    expect(md).toContain("_2 models_");
    // Two transformation section headers.
    expect(md).toContain("## P");
    expect(md).toContain("## IN");
    // Model sub-headers with code:name shape.
    expect(md).toMatch(/### P1: /);
    expect(md).toMatch(/### IN3: /);
    // Trailing newline (output is write-friendly).
    expect(md.endsWith("\n")).toBe(true);
  });

  it("markdown groups are ordered P, IN, CO, DE, RE, SY", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "markdown",
      codes: ["SY1", "RE1", "P1", "DE1", "CO1", "IN1"],
    });
    const md = result.structuredContent.content as string;
    const order = ["## P ", "## IN ", "## CO ", "## DE ", "## RE ", "## SY "];
    const indices = order.map((h) => md.indexOf(h));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it("returns an empty-state markdown when nothing matches", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "markdown",
      codes: ["ZZ99"],
    });
    expect(result.structuredContent.modelCount).toBe(0);
    const md = result.structuredContent.content as string;
    expect(md).toContain("_No models matched the filter._");
  });

  // --- PDF format tests ---

  it("returns a resource content block with application/pdf mimeType for pdf format", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "pdf",
      codes: ["P1", "IN3"],
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("resource");
    expect(result.content[0].resource.mimeType).toBe("application/pdf");
    expect(result.structuredContent.format).toBe("pdf");
    expect(result.structuredContent.modelCount).toBe(2);
  });

  it("produces a valid PDF (starts with %PDF magic bytes)", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "pdf",
      codes: ["P1"],
    });
    const base64 = result.structuredContent.content as string;
    const binary = atob(base64);
    expect(binary.slice(0, 5)).toBe("%PDF-");
  });

  it("reports correct byteLength matching the decoded base64 length", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "pdf",
      codes: ["P1", "CO1", "DE1"],
    });
    const base64 = result.structuredContent.content as string;
    const decodedLength = atob(base64).length;
    expect(result.structuredContent.byteLength).toBe(decodedLength);
  });

  it("surfaces missingCodes in PDF mode just like other formats", async () => {
    const tool = mockServer.getTool("export_models");
    const result = await tool.handler({
      format: "pdf",
      codes: ["P1", "ZZ99"],
    });
    expect(result.structuredContent.modelCount).toBe(1);
    expect(result.structuredContent.missingCodes).toEqual(["ZZ99"]);
    // Still produces a valid PDF for the one matched model.
    const binary = atob(result.structuredContent.content as string);
    expect(binary.slice(0, 5)).toBe("%PDF-");
  });
});
