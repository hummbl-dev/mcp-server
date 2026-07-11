# Tool Exposure Profiles

## Overview

The MCP server supports server-side tool exposure profiles that control
which tools, resources, and prompts are registered on the server.

This is **server-side enforcement**, not a client hint. The server
decides what to expose based on the profile, not the client.

## Profiles

| Profile | Description | Use case |
|---------|-------------|----------|
| `readonly` | Model, methodology, export, resources, prompts; no workflow mutation tools | Public/unauthenticated access |
| `dev` | Full tool set for local development | Local development only |
| `prod` | Full or scoped tool set after auth/authz | Production with authentication |
| `full` | All tools including workflow mutation | Backward-compatible default |

## Usage

```typescript
import { createServer } from "./server.js";

// Full profile (default, backward compatible)
const server = createServer();

// Read-only profile
const readonlyServer = createServer({ profile: "readonly" });

// Dev profile
const devServer = createServer({ profile: "dev" });

// Production profile
const prodServer = createServer({ profile: "prod" });
```

## Backward compatibility

- `createServer()` without options defaults to `full` profile
- `createReadOnlyServer()` is a convenience wrapper for `createServer({ profile: "readonly" })`
- Existing code using `createServer()` or `createReadOnlyServer()` continues to work

## Client hints vs server-side enforcement

MCP clients may send hints like `readOnlyHint` in their initialization
parameters. These are **client preferences**, not server-side enforcement.

The server-side profile system is the authoritative control. Even if a
client does not send `readOnlyHint`, the server will only expose the
tools allowed by its configured profile.

## CI guard

Tests in `src/__tests__/tool-profiles.test.ts` and
`src/__tests__/public-tool-profile.test.ts` enforce:

- Write tools are absent from the readonly profile
- Read-only tools are present in the readonly profile
- Readonly profile has strictly fewer tools than the full profile
- Public agent uses the readonly profile

Refs: hummbl-dev/mcp-server#342
