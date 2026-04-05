/**
 * HUMMBL Export Tool
 *
 * Emits a curated set of Base120 mental models as either structured JSON
 * or human-readable Markdown. Useful for building briefing docs, slide
 * decks, or feeding a model set into another LLM's context window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { TRANSFORMATIONS, getAllModels, getModelByCode } from "../framework/base120.js";
import { isOk, isTransformationType } from "../types/domain.js";
import type { MentalModel } from "../types/domain.js";

type ExportFormat = "markdown" | "json";

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

  // Group by transformation in the canonical P/IN/CO/DE/RE/SY order.
  const order = ["P", "IN", "CO", "DE", "RE", "SY"];
  const grouped = new Map<string, ModelWithTransformation[]>();
  for (const m of models) {
    const key = m.transformation || "(uncategorized)";
    const list = grouped.get(key) ?? [];
    list.push(m);
    grouped.set(key, list);
  }

  const lines: string[] = [];
  lines.push("# HUMMBL Base120 Export", "");
  lines.push(`_${models.length} model${models.length === 1 ? "" : "s"}_`, "");

  const keys = [
    ...order.filter((k) => grouped.has(k)),
    ...[...grouped.keys()].filter((k) => !order.includes(k)),
  ];
  for (const key of keys) {
    const t = TRANSFORMATIONS[key];
    const heading = t ? `${key} — ${t.name}` : key;
    lines.push(`## ${heading}`, "");
    if (t?.description) {
      lines.push(`_${t.description}_`, "");
    }
    const entries = grouped.get(key) ?? [];
    // Sort within group by priority then code for stable output.
    entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
    for (const m of entries) {
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

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "export_models",
    {
      title: "Export HUMMBL Models",
      description:
        "Export a curated subset of Base120 mental models as Markdown or JSON for docs, decks, or feeding into another LLM's context. Pass `codes` for a specific list, `transformation` for a whole group, or neither for all 120.",
      inputSchema: z.object({
        format: z
          .enum(["markdown", "json"])
          .describe("Output format: 'markdown' (human-readable) or 'json' (structured)."),
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
        format: z.enum(["markdown", "json"]),
        modelCount: z.number(),
        missingCodes: z.array(z.string()),
        content: z.string(),
      }),
    },
    async ({ format, codes, transformation }) => {
      const { models, missingCodes } = resolveModels({ codes, transformation });
      const fmt = format as ExportFormat;
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
