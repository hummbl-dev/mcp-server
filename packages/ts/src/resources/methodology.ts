import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getSelfDialecticalMethodology } from "../framework/self_dialectical.js";
import { isOk } from "../types/domain.js";

export function registerMethodologyResources(server: McpServer): void {
  // Resource: Self-Dialectical AI Methodology definition (JSON)
  server.registerResource(
    "self-dialectical-methodology",
    "hummbl://methodology/self-dialectical-ai",
    {
      title: "Self-Dialectical AI Methodology",
      description:
        "Canonical Self-Dialectical AI Systems methodology with HUMMBL Base120 mappings.",
      mimeType: "application/json",
    },
    async (uri: URL) => {
      const result = getSelfDialecticalMethodology();

      if (!isOk(result)) {
        throw new Error(`Unable to retrieve Self-Dialectical methodology: ${result.error.type}`);
      }

      const methodology = result.value;

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(methodology, null, 2),
          },
        ],
      };
    }
  );

  // Resource: Self-Dialectical AI Methodology overview (Markdown)
  server.registerResource(
    "self-dialectical-methodology-markdown",
    "hummbl://methodology/self-dialectical-ai/overview",
    {
      title: "Self-Dialectical AI Methodology (Markdown Overview)",
      description:
        "Human-readable markdown overview of the Self-Dialectical AI Systems methodology, derived from the canonical structured definition.",
      mimeType: "text/markdown",
    },
    async (uri: URL) => {
      const result = getSelfDialecticalMethodology();

      if (!isOk(result)) {
        throw new Error(`Unable to retrieve Self-Dialectical methodology: ${result.error.type}`);
      }

      const methodology = result.value;

      const stagesMarkdown = methodology.stages
        .map((stage) => {
          const models = stage.modelCodes.length
            ? stage.modelCodes.map((code) => `- ${code}`).join("\n")
            : "- (none)";

          return [
            `### Stage: ${stage.title} (${stage.stage})`,
            "",
            `${stage.description}`,
            "",
            "**Models Referenced:**",
            models,
            "",
          ].join("\n");
        })
        .join("\n\n");

      const metaModelsMarkdown = methodology.metaModels.length
        ? methodology.metaModels.map((code) => `- ${code}`).join("\n")
        : "- (none)";

      const modelsReferencedMarkdown = methodology.modelsReferenced.length
        ? methodology.modelsReferenced.map((code) => `- ${code}`).join("\n")
        : "- (none)";

      const lines: string[] = [];
      lines.push(`# ${methodology.title}`);
      lines.push("");
      lines.push(`**ID**: ${methodology.id}  `);
      lines.push(`**Version**: ${methodology.version}`);
      lines.push("");
      if (methodology.documentUrl) {
        lines.push(`**Document URL**: ${methodology.documentUrl}`);
        lines.push("");
      }
      if (methodology.totalPages !== undefined) {
        lines.push(`**Total Pages**: ${methodology.totalPages}`);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
      lines.push("## Summary");
      lines.push("");
      lines.push(methodology.summary);
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push("## Models Referenced");
      lines.push("");
      lines.push(modelsReferencedMarkdown);
      lines.push("");
      lines.push("## Meta-Models");
      lines.push("");
      lines.push(metaModelsMarkdown);
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push("## Stages");
      lines.push("");
      lines.push(stagesMarkdown);
      lines.push("");

      const markdown = lines.join("\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      };
    }
  );
}
