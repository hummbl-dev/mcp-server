/**
 * Test utilities and shared fixtures for HUMMBL MCP Server tests
 */

import { MentalModel, Transformation } from "../types/domain.js";

/**
 * Sample mental models for testing
 */
export const mockModels: MentalModel[] = [
  {
    code: "P1",
    name: "First Principles",
    definition: "Break down problems to fundamental truths and build up from there",
    priority: 1,
  },
  {
    code: "IN1",
    name: "Inversion",
    definition: "Think about what you want to avoid instead of what you want to achieve",
    priority: 1,
  },
  {
    code: "CO1",
    name: "Emergence",
    definition: "Understand how simple rules create complex patterns",
    priority: 1,
  },
];

/**
 * Sample transformation for testing
 */
export const mockTransformation: Transformation = {
  key: "P",
  name: "Perspective",
  description: "Change viewpoint to see problems differently",
  models: [mockModels[0]],
};

/**
 * Test problem descriptions
 */
export const testProblems = {
  growth: "Our startup is growing rapidly but systems are breaking down",
  decision: "We need to make a strategic decision about product direction",
  innovation: "Looking for innovative approaches to solve customer problems",
};

/**
 * Helper to create mock MCP server instance
 */
export function createMockServer() {
  const tools = new Map();
  const resources = new Map();

  return {
    registerTool: (name: string, schema: any, handler: any) => {
      tools.set(name, { schema, handler });
    },
    registerResource: (template: string, handler: any) => {
      resources.set(template, handler);
    },
    getTool: (name: string) => tools.get(name),
    getResource: (template: string) => resources.get(template),
    tools,
    resources,
  };
}
