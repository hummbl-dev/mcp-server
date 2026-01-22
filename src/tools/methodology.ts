import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  type AuditInputItem,
  getSelfDialecticalMethodology,
  auditModelCodes,
} from "../framework/self_dialectical.js";
import { isOk } from "../types/domain.js";

export function registerMethodologyTools(server: McpServer): void {
  // Tool: Get Self-Dialectical AI Methodology definition
  server.registerTool(
    "get_methodology",
    {
      title: "Get Self-Dialectical AI Methodology",
      description:
        "Retrieve the canonical Self-Dialectical AI Systems methodology with HUMMBL Base120 mappings.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        id: z.string(),
        title: z.string(),
        version: z.string(),
        summary: z.string(),
        documentUrl: z.string().optional(),
        totalPages: z.number().optional(),
        modelsReferenced: z.array(z.string()),
        stages: z.array(
          z.object({
            stage: z.enum(["thesis", "antithesis", "synthesis", "convergence", "meta_reflection"]),
            title: z.string(),
            description: z.string(),
            modelCodes: z.array(z.string()),
          })
        ),
        metaModels: z.array(z.string()),
      }),
    },
    async () => {
      const result = getSelfDialecticalMethodology();

      if (!isOk(result)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unable to retrieve Self-Dialectical methodology: ${result.error.type}`,
            },
          ],
          isError: true as const,
        };
      }

      const methodology = result.value;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(methodology, null, 2),
          },
        ],
        structuredContent: methodology as unknown as { [key: string]: unknown },
      };
    }
  );

  // Tool: Audit model references against HUMMBL Base120 and methodology expectations
  server.registerTool(
    "audit_model_references",
    {
      title: "Audit HUMMBL Model References",
      description:
        "Audit a list of HUMMBL model references for existence, transformation alignment, and duplicates.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              code: z.string().min(2).describe("Model code, e.g., IN11, CO4"),
              expectedTransformation: z
                .enum(["P", "IN", "CO", "DE", "RE", "SY"])
                .optional()
                .describe("Optional expected transformation key for this reference"),
            })
          )
          .min(1),
      }),
      outputSchema: z.object({
        methodologyId: z.string(),
        documentVersion: z.string(),
        totalReferences: z.number(),
        validCount: z.number(),
        invalidCount: z.number(),
        issues: z.array(
          z.object({
            code: z.string(),
            issueType: z.enum(["NotFound", "WrongTransformation", "Duplicate", "Unknown"]),
            message: z.string(),
            expectedTransformation: z.string().optional(),
            actualTransformation: z.string().optional(),
          })
        ),
      }),
    },
    async ({ items }) => {
      const auditItems: AuditInputItem[] = items.map((item) => ({
        code: item.code,
        expectedTransformation: item.expectedTransformation,
      }));

      const result = auditModelCodes(auditItems);

      if (!isOk(result)) {
        const error = result.error;
        const baseMessage =
          error.type === "ValidationError"
            ? error.message
            : `Unable to audit model references: ${error.type}`;

        return {
          content: [
            {
              type: "text" as const,
              text: baseMessage,
            },
          ],
          isError: true as const,
        };
      }

      const payload = result.value;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload as unknown as { [key: string]: unknown },
      };
    }
  );
}
