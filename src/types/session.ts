/**
 * Session type definitions for MCP server state persistence
 * Ported from Python Phase 1C implementation
 */

import { z } from "zod";

// Domain state schema - flexible record for any domain-specific data
export const DomainStateSchema = z.record(z.string(), z.unknown());
export type DomainState = z.infer<typeof DomainStateSchema>;

// Session metadata schema
export const SessionMetadataSchema = z.object({
  totalMessages: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  activeTools: z.array(z.string()),
  lastActivity: z.iso.datetime({}).optional(),
  clientInfo: z.record(z.string(), z.unknown()).optional(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

// Main session schema
export const SessionSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  adapterType: z.string(),
  createdAt: z.iso.datetime({}),
  lastActive: z.iso.datetime({}),
  version: z.number().int().positive(),
  domainState: DomainStateSchema,
  metadata: SessionMetadataSchema,
});

export type Session = z.infer<typeof SessionSchema>;

// Helper function to create a new session
export function createSession(
  userId: string,
  adapterType: string,
  initialDomainState: DomainState = {}
): Session {
  const now = new Date().toISOString();

  return {
    sessionId: crypto.randomUUID(),
    userId,
    adapterType,
    createdAt: now,
    lastActive: now,
    version: 1,
    domainState: initialDomainState,
    metadata: {
      totalMessages: 0,
      totalCostUsd: 0,
      activeTools: [],
    },
  };
}

// Helper function to update session activity
export function updateSessionActivity(session: Session): Session {
  return {
    ...session,
    lastActive: new Date().toISOString(),
    metadata: {
      ...session.metadata,
      lastActivity: new Date().toISOString(),
    },
  };
}

// Helper function to increment version (for optimistic locking)
export function incrementSessionVersion(session: Session): Session {
  return {
    ...session,
    version: session.version + 1,
  };
}
