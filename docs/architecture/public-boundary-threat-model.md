# Threat Model: Accidental User-Data Exposure via Public MCP

## Scope

This threat model covers accidental exposure of user data through the
public MCP server surface (tools, resources, logs, errors, caches).

Refs: hummbl-dev/mcp-server#377

## STRIDE Analysis

### Spoofing

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Attacker spoofs public MCP endpoint to capture user data | Low | High | TLS, certificate pinning, documented endpoint URLs |
| Attacker injects user-data fields into public tool calls | Medium | High | Schema validation rejects unknown fields; CI guard scans for prohibited field names |

### Tampering

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Public tool mutates durable user-model state | Low | Critical | No write tools registered in public tool set; CI guard enforces |
| Attacker tampers with canonical model data | Low | Medium | Canonical data is versioned and hash-verified |

### Repudiation

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| User denies making observation that was never supposed to be on public surface | Low | Medium | No observation ingestion on public surface; nothing to repudiate |

### Information Disclosure

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Error messages echo raw user input containing personal data | Medium | High | Error redaction rules; generic error codes; CI test for error payload leakage |
| Logs persist personal observations | Medium | High | Log redaction policy; no free-form input logged; CI test for log leakage |
| Resource URIs enumerate private user identifiers | Low | High | Resource URI schema is fixed to model codes and transformation keys; no user-id URIs |
| Cache stores user-model data | Low | High | Public cache only stores canonical model data; no user-data cache path |
| Tool output includes inferred personal traits | Low | Critical | Public tools return only canonical model data; CI guard scans output schemas |

### Denial of Service

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Attacker floods public endpoint | Medium | Low | Rate limiting, Cloudflare protection |

### Elevation of Privilege

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Attacker gains write access via public tool | Low | Critical | No write tools in public set; CI guard enforces |
| Attacker accesses private runtime via public endpoint | Low | Critical | Private runtime is separately authenticated; not implemented on public surface |

## Test Coverage

| Test | Threat addressed |
|------|-----------------|
| Public tools remain read-only | Tampering, Elevation |
| Tool schemas contain no user-profile fields | Information Disclosure |
| Logging does not persist personal observations | Information Disclosure |
| Errors do not echo raw sensitive payloads | Information Disclosure |
| Resource URIs cannot enumerate private identifiers | Information Disclosure |
| Published candidate model requires explicit public posture | Information Disclosure |
| Unauthenticated private-world-model request is denied | Elevation |
| Write/mutation tool cannot register in public set | Tampering, Elevation |

## Residual Risks

- Future private runtime must maintain separate authentication
- De-identification policy is separately reviewed
- No claim that current public surface handles all future user-data scenarios
