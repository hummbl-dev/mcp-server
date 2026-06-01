/**
 * HUMMBL Export Tool
 *
 * Emits a curated set of Base120 mental models as structured JSON,
 * human-readable Markdown, or a downloadable PDF. Useful for building
 * briefing docs, slide decks, or feeding a model set into another
 * LLM's context window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsPDF } from "jspdf";

import { TRANSFORMATIONS, getAllModels, getModelByCode } from "../framework/base120.js";
import { isOk, isTransformationType } from "../types/domain.js";
import type { MentalModel } from "../types/domain.js";

type ExportFormat = "markdown" | "json" | "pdf";

type ModelWithTransformation = MentalModel & { transformation: string };

/**
 * Resolve the set of models to export based on the filter parameters.
 * Precedence: if `codes` is given it wins; else if `transformation` is
 * given, only that transformation's models are returned; else all 120.
 */
function resolveModels(input: { codes?: string[]; transformation?: string }): {
  models: ModelWithTransformation[];
  missingCodes: string[];
} {
  const missingCodes: string[] = [];

  // Build code -> transformation key lookup from the canonical data.
  const codeToTransformation = new Map<string, string>();
  for (const t of Object.values(TRANSFORMATIONS)) {
    for (const m of t.models) {
      codeToTransformation.set(m.code, t.key);
    }
  }

  // When `codes` is explicitly provided — even as an empty array — treat
  // it as an explicit filter. `codes: []` means "export exactly zero
  // models", NOT "fall through to transformation/all". This matches the
  // precedence documented in the tool description and prevents a
  // programmatic caller that supplies an empty list from receiving a
  // surprise 120-model payload.
  if (input.codes !== undefined) {
    const models: ModelWithTransformation[] = [];
    for (const rawCode of input.codes) {
      const code = rawCode.toUpperCase();
      const result = getModelByCode(code);
      if (!isOk(result)) {
        missingCodes.push(code);
        continue;
      }
      models.push({
        ...result.value,
        transformation: codeToTransformation.get(result.value.code) ?? "",
      });
    }
    return { models, missingCodes };
  }

  if (input.transformation) {
    const tKey = input.transformation.toUpperCase();
    if (!isTransformationType(tKey)) {
      return { models: [], missingCodes: [] };
    }
    const t = TRANSFORMATIONS[tKey];
    return {
      models: t.models.map((m) => ({ ...m, transformation: t.key })),
      missingCodes: [],
    };
  }

  // Default: all models.
  return {
    models: getAllModels().map((m) => ({
      ...m,
      transformation: codeToTransformation.get(m.code) ?? "",
    })),
    missingCodes: [],
  };
}

function renderMarkdown(models: ModelWithTransformation[]): string {
  if (models.length === 0) {
    return "# HUMMBL Base120 Export\n\n_No models matched the filter._\n";
  }

  const lines: string[] = [];
  lines.push("# HUMMBL Base120 Export", "");
  lines.push(`_${models.length} model${models.length === 1 ? "" : "s"}_`, "");

  for (const group of groupByTransformation(models)) {
    lines.push(`## ${group.heading}`, "");
    if (group.description) {
      lines.push(`_${group.description}_`, "");
    }
    for (const m of group.entries) {
      lines.push(`### ${m.code}: ${m.name}`, "");
      lines.push(`_Priority ${m.priority}_`, "");
      lines.push(m.definition, "");
    }
  }
  return lines.join("\n") + "\n";
}

function renderJson(models: ModelWithTransformation[]): string {
  return (
    JSON.stringify(
      {
        framework: "HUMMBL Base120",
        count: models.length,
        models: models.map((m) => ({
          code: m.code,
          name: m.name,
          definition: m.definition,
          priority: m.priority,
          transformation: m.transformation,
        })),
      },
      null,
      2
    ) + "\n"
  );
}

/**
 * Group models by transformation in canonical order for rendering.
 * Shared between renderMarkdown and renderPdf.
 */
function groupByTransformation(models: ModelWithTransformation[]): Array<{
  key: string;
  heading: string;
  description: string;
  entries: ModelWithTransformation[];
}> {
  const order = ["P", "IN", "CO", "DE", "RE", "SY"];
  const grouped = new Map<string, ModelWithTransformation[]>();
  for (const m of models) {
    const key = m.transformation || "(uncategorized)";
    const list = grouped.get(key) ?? [];
    list.push(m);
    grouped.set(key, list);
  }
  const keys = [
    ...order.filter((k) => grouped.has(k)),
    ...[...grouped.keys()].filter((k) => !order.includes(k)),
  ];
  return keys.map((key) => {
    const t = TRANSFORMATIONS[key];
    const entries = grouped.get(key) ?? [];
    entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
    return {
      key,
      heading: t ? `${key} — ${t.name}` : key,
      description: t?.description ?? "",
      entries,
    };
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function renderPdf(models: ModelWithTransformation[]): { base64: string; byteLength: number } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPageBreak = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
      addPage();
    }
  };

  // Title
  doc.setFontSize(20);
  doc.text("HUMMBL Base120 Export", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`${models.length} model${models.length === 1 ? "" : "s"}`, margin, y);
  y += 10;

  if (models.length === 0) {
    doc.setFontSize(12);
    doc.text("No models matched the filter.", margin, y);
  } else {
    const groups = groupByTransformation(models);
    for (const group of groups) {
      checkPageBreak(20);
      // Section heading
      doc.setFontSize(14);
      doc.text(group.heading, margin, y);
      y += 6;
      if (group.description) {
        doc.setFontSize(9);
        doc.text(group.description, margin, y);
        y += 5;
      }
      y += 2;

      for (const m of group.entries) {
        checkPageBreak(18);
        // Model code + name
        doc.setFontSize(11);
        doc.text(`${m.code}: ${m.name}`, margin, y);
        y += 5;
        // Definition (may wrap)
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(m.definition, usableWidth);
        for (const line of lines) {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4;
        }
        y += 3;
      }
      y += 4;
    }
  }

  const buffer = doc.output("arraybuffer");
  return {
    base64: arrayBufferToBase64(buffer),
    byteLength: buffer.byteLength,
  };
}

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "export_models",
    {
      title: "Export HUMMBL Models",
      description:
        "Export a curated subset of Base120 mental models as Markdown, JSON, or PDF. Pass `codes` for a specific list, `transformation` for a whole group, or neither for all 120.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        format: z
          .enum(["markdown", "json", "pdf"])
          .describe("Output format: 'markdown', 'json', or 'pdf'."),
        codes: z
          .array(z.string())
          .optional()
          .describe("Optional list of model codes (e.g. ['P1','IN3','CO5']). Takes precedence."),
        transformation: z
          .string()
          .optional()
          .describe("Optional transformation key (P, IN, CO, DE, RE, SY) to export a whole group."),
      }),
      outputSchema: z.object({
        format: z.enum(["markdown", "json", "pdf"]),
        modelCount: z.number(),
        missingCodes: z.array(z.string()),
        content: z.string(),
        byteLength: z.number().optional(),
      }),
    },
    async ({ format, codes, transformation }) => {
      const { models, missingCodes } = resolveModels({ codes, transformation });
      const fmt = format as ExportFormat;

      if (fmt === "pdf") {
        const { base64, byteLength } = renderPdf(models);
        return {
          content: [
            {
              type: "resource" as const,
              resource: {
                uri: `data:application/pdf;base64,${base64}`,
                mimeType: "application/pdf",
                blob: base64,
              },
            },
          ],
          structuredContent: {
            format: fmt,
            modelCount: models.length,
            missingCodes,
            content: base64,
            byteLength,
          },
        };
      }

      const content = fmt === "markdown" ? renderMarkdown(models) : renderJson(models);
      return {
        content: [{ type: "text", text: content }],
        structuredContent: {
          format: fmt,
          modelCount: models.length,
          missingCodes,
          content,
        },
      };
    }
  );
}
