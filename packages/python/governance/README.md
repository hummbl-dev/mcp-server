# hummbl-mcp-governance

MCP servers exposing HUMMBL governance primitives — 7 servers, 32+ JSON-RPC tools.

## Servers (7)

| Server | Entry point | Tools | Wraps |
|--------|-------------|-------|-------|
| **Governance** | `hummbl-governance-mcp` | 10 | KillSwitch, CircuitBreaker, CostGovernor, AuditLog, ComplianceMapper, HealthProbe |
| **Compliance** | `hummbl-compliance-mcp` | 5 | NIST AI RMF, SOC2, ISO crosswalk, STRIDE, evidence export |
| **Sandbox** | `hummbl-sandbox-mcp` | 5 | CapabilityFence, OutputValidator sandbox |
| **Identity** | `hummbl-identity-mcp` | 10 | AgentRegistry, DelegationTokenManager, LamportClock |
| **Agent Monitor** | `hummbl-agent-monitor-mcp` | 11 | BehaviorMonitor, ConvergenceDetector, GovernanceLifecycle, EvolutionLineage |
| **Reasoning** | `hummbl-reasoning-mcp` | — | ReasoningEngine, SchemaValidator, ContractNetManager |
| **Physical AI** | `hummbl-physical-mcp` | 6 | KinematicGovernor, pHRISafetyMonitor |

## Install

```bash
pip install hummbl-mcp-governance
```

## Run

```bash
# Any of the 7 entry points
hummbl-governance-mcp
hummbl-compliance-mcp
hummbl-sandbox-mcp
hummbl-identity-mcp
hummbl-agent-monitor-mcp
hummbl-reasoning-mcp
hummbl-physical-mcp
```

## Dependencies

- `hummbl-governance>=1.1.0` (from PyPI)

## License

Apache-2.0
