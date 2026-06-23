# HUMMBL MCP Server: OLD vs NEW Architecture

**Date**: 2026-01-21
**Status**: NEW architecture implemented, enhancements planned

---

## Quick Summary

| Aspect | OLD Version | NEW Version |
|--------|-------------|-------------|
| **Purpose** | Stateless mental models lookup | Stateful sessions + observability |
| **Storage** | None (ephemeral) | Redis (cache) + D1 (persistent) |
| **Observability** | None | Full stack (logs, metrics, traces) |
| **Complexity** | ~500 LOC | ~2,000+ LOC |
| **Deployment** | stdio only | stdio + potential HTTP/SSE |
| **State** | None | Session + History tracking |

---

## Architecture Comparison

### OLD Version: Minimal MCP Server

```
┌─────────────────────────────────────┐
│         MCP Client (Claude)          │
└─────────────────┬───────────────────┘
                  │ stdio
                  ▼
┌─────────────────────────────────────┐
│          HUMMBL MCP Server           │
│  ┌───────────────────────────────┐  │
│  │   Tools Layer (6 tools)       │  │
│  ├───────────────────────────────┤  │
│  │   Resources (3 URIs)          │  │
│  ├───────────────────────────────┤  │
│  │   Base120 Framework (data)    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Characteristics**:
- ✅ Simple, fast, reliable
- ✅ Perfect for read-only mental models
- ❌ No state persistence
- ❌ No usage tracking
- ❌ Can't build on previous interactions

---

### NEW Version: Production-Ready with Persistence

```
┌─────────────────────────────────────┐
│         MCP Client (Claude)          │
└─────────────────┬───────────────────┘
                  │ stdio
                  ▼
┌─────────────────────────────────────────────────────┐
│               HUMMBL MCP Server                      │
│  ┌───────────────────────────────────────────────┐  │
│  │          Tools Layer (6 + new)                │  │
│  │    • get_model                                │  │
│  │    • search_models                            │  │
│  │    • recommend_models                         │  │
│  │    • [future: guided workflows]               │  │
│  └───────────────────────────────────────────────┘  │
│                           │                          │
│  ┌────────────────────────┴──────────────────────┐  │
│  │          Storage Layer                        │  │
│  │    ┌──────────────┐    ┌──────────────┐     │  │
│  │    │ Session Mgr  │    │ History Mgr  │     │  │
│  │    └──────┬───────┘    └──────┬───────┘     │  │
│  │           │                     │             │  │
│  │    ┌──────▼───────┐    ┌──────▼───────┐     │  │
│  │    │ Redis Client │    │  D1 Client   │     │  │
│  │    │  (cache)     │    │ (durable)    │     │  │
│  │    └──────────────┘    └──────────────┘     │  │
│  └───────────────────────────────────────────────┘  │
│                           │                          │
│  ┌────────────────────────┴──────────────────────┐  │
│  │       Observability Layer                     │  │
│  │    ┌────────┐  ┌─────────┐  ┌──────────┐    │  │
│  │    │ Logger │  │ Metrics │  │ Tracing  │    │  │
│  │    │(struct)│  │(Prom)   │  │ (OTEL)   │    │  │
│  │    └────────┘  └─────────┘  └──────────┘    │  │
│  └───────────────────────────────────────────────┘  │
│                           │                          │
│  ┌────────────────────────┴──────────────────────┐  │
│  │          Base120 Framework                    │  │
│  │         (120 Mental Models)                   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
     ┌──────────┐        ┌────────────┐
     │  Redis   │        │ Cloudflare │
     │  Cache   │        │     D1     │
     └──────────┘        └────────────┘
```

**Characteristics**:
- ✅ All benefits of OLD version
- ✅ **State persistence** across conversations
- ✅ **Multi-turn workflows** possible
- ✅ **Production observability** (logs, metrics, traces)
- ✅ **Usage analytics** capability
- ✅ **Scalable** architecture (cache + database)

---

## Detailed Component Comparison

### 1. Tools Layer

#### OLD
```typescript
// 6 basic tools, no state
- get_model(code)
- list_all_models(filter?)
- search_models(query)
- recommend_models(problem)
- get_transformation(key)
- search_problem_patterns(query)
```

#### NEW
```typescript
// Same 6 tools + infrastructure for stateful tools
- [All above tools] ✅
- [PLANNED] apply_guided_workflow(problem, type)
- [PLANNED] get_my_usage_stats(period)
```

---

### 2. Storage Layer

#### OLD
```
❌ None - fully stateless
```

#### NEW
```typescript
✅ SessionManager
   - Redis cache (hot data, 24h TTL)
   - D1 database (cold storage, permanent)
   - Session versioning (optimistic locking)
   - Activity tracking

✅ HistoryManager
   - Message history per session
   - Conversation context preservation
   - Replay capabilities
```

**Storage Flow**:
```
Request → SessionManager.get(sessionId)
            ↓
        Redis Check
            ├── HIT → return from Redis
            └── MISS → fetch from D1 → cache in Redis

Update → SessionManager.update(session)
            ↓
         Write to Redis (immediate)
            ↓
         Write to D1 (async, durable)
```

---

### 3. Observability Layer

#### OLD
```
❌ None - no visibility into usage
```

#### NEW
```typescript
✅ Logger (src/observability/logger.ts)
   - Structured JSON logs
   - Contextual data (userId, sessionId)
   - Log levels (debug, info, warn, error)
   - Timer decorators for performance

✅ Metrics (src/observability/metrics.ts)
   - Counter: session create/get/update counts
   - Gauge: active sessions
   - Histogram: operation durations
   - Cache hit/miss rates

✅ Tracing (src/observability/tracing.ts)
   - OpenTelemetry instrumentation
   - Span creation with @trace decorator
   - Distributed tracing ready
   - Performance profiling
```

**Metrics Available**:
```typescript
- session_create_total
- session_create_duration_seconds
- cache_hit_total / cache_miss_total
- active_sessions_count
- d1_write_total / d1_read_total
```

---

### 4. Type System

#### OLD
```typescript
// Basic types only
- MentalModel
- Transformation
- ProblemPattern
- Result<T, E>
```

#### NEW
```typescript
// Enhanced type coverage
- [All OLD types] ✅
- Session (with metadata)
- SessionMetadata (tracking)
- DomainState (flexible state)
- Message (conversation history)
- MessageRole (user/assistant/system)
```

---

## Code Organization

### OLD Structure
```
src/
├── index.ts          (80 LOC)
├── server.ts         (27 LOC)
├── framework/
│   └── base120.ts    (~1500 LOC - data)
├── tools/
│   └── models.ts     (405 LOC)
├── resources/
│   └── models.ts     (109 LOC)
├── types/
│   └── domain.ts     (70 LOC)
└── utils/
    └── result.ts     (25 LOC)

Total: ~2,200 LOC (mostly data)
```

### NEW Structure
```
src/
├── index.ts                      (26 LOC)
├── server.ts                     (27 LOC)
├── framework/
│   └── base120.ts                (~1500 LOC - data)
├── tools/
│   └── models.ts                 (405 LOC)
├── resources/
│   └── models.ts                 (109 LOC)
├── storage/                      ⭐ NEW
│   ├── session-manager.ts        (350 LOC)
│   ├── history-manager.ts        (280 LOC)
│   ├── redis-client.ts           (100 LOC)
│   └── d1-client.ts             (120 LOC)
├── observability/                ⭐ NEW
│   ├── logger.ts                 (180 LOC)
│   ├── metrics.ts                (200 LOC)
│   └── tracing.ts                (180 LOC)
├── types/
│   ├── domain.ts                 (70 LOC)
│   ├── session.ts                ⭐ NEW (80 LOC)
│   └── message.ts                ⭐ NEW (60 LOC)
└── utils/
    ├── result.ts                 (25 LOC)
    └── sanitize.ts               ⭐ NEW (120 LOC)

Total: ~3,800 LOC (+73% code, infrastructure)
```

---

## Performance Characteristics

| Operation | OLD | NEW (Cache Hit) | NEW (Cache Miss) |
|-----------|-----|-----------------|------------------|
| Get Model | ~2ms | ~2ms | ~2ms |
| Search | ~5ms | ~5ms | ~5ms |
| Create Session | N/A | ~15ms (Redis) | ~50ms (Redis+D1) |
| Get Session | N/A | ~3ms (Redis) | ~20ms (D1) |
| Update Session | N/A | ~8ms (Redis) | ~30ms (Redis+D1) |

**Memory**:
- OLD: ~10MB (data only)
- NEW: ~15MB (data + Redis client + OTEL)

---

## Migration Path

### If you're on OLD version:
```bash
# No breaking changes - NEW is backward compatible
npm install @hummbl/mcp-server@latest

# Optional: Enable storage (requires env vars)
REDIS_URL=redis://localhost:6379
D1_DATABASE_ID=your-d1-id

# Optional: Enable observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### If you don't need persistence:
- NEW version works exactly like OLD (stateless mode)
- Storage only activates when Redis URL is configured
- Zero performance penalty if not used

---

## Use Case Fit

### When to use OLD architecture:
- ✅ Simple mental model lookup
- ✅ One-off queries
- ✅ No need for history
- ✅ Minimal dependencies
- ✅ Learning/experimentation

### When to use NEW architecture:
- ✅ Multi-turn problem solving
- ✅ Guided workflows
- ✅ Usage analytics needed
- ✅ Production deployment
- ✅ Team/organization rollout
- ✅ Continuous improvement based on data

---

## What This Enables

With the NEW architecture, we can now build:

1. **Guided Workflows** ✨
   - Multi-step problem solving
   - Session-based state tracking
   - Resume interrupted analysis

2. **User Analytics** 📊
   - Which models are most useful
   - Common problem patterns
   - Workflow success rates

3. **Personalization** 🎯
   - Recommend models based on user history
   - Adapt to user expertise level
   - Custom workflow templates

4. **Collaboration** 🤝
   - Share analysis sessions
   - Team-wide usage patterns
   - Organizational learning

5. **Production Operations** 🚀
   - Monitor health and performance
   - Debug issues with traces
   - Scale based on metrics

---

## Summary

The NEW version is **backward compatible** but adds a **production-grade foundation** for:
- State persistence
- Multi-turn interactions
- Usage analytics
- Operational visibility

**The mental models are the same. The capabilities are vastly expanded.**

---

*Ready for enhancement implementation. See ENHANCEMENT_PLAN.md for next steps.*
