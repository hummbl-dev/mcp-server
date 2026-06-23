/**
 * Message type definitions for MCP server conversation history
 * Ported from Python Phase 1C implementation
 */

import { z } from "zod";

// Message role enum
export const MessageRoleSchema = z.enum(["user", "assistant", "tool", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

// Tool call schema
export const ToolCallSchema = z.object({
  id: z.string().optional(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(), // JSON string
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// Message schema
export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolCallId: z.string().optional(),
  timestamp: z.iso.datetime({}),
  metadata: z.record(z.string(), z.unknown()).optional(), // For cost, tokens, etc.
});

export type Message = z.infer<typeof MessageSchema>;

// Helper function to create a user message
export function createUserMessage(content: string): Message {
  return {
    role: "user",
    content,
    timestamp: new Date().toISOString(),
  };
}

// Helper function to create an assistant message
export function createAssistantMessage(content: string, toolCalls?: ToolCall[]): Message {
  return {
    role: "assistant",
    content,
    toolCalls,
    timestamp: new Date().toISOString(),
  };
}

// Helper function to create a tool message
export function createToolMessage(toolCallId: string, content: string): Message {
  return {
    role: "tool",
    content,
    toolCallId,
    timestamp: new Date().toISOString(),
  };
}

// Helper function to create a system message
export function createSystemMessage(content: string): Message {
  return {
    role: "system",
    content,
    timestamp: new Date().toISOString(),
  };
}
