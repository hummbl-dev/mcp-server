# Lexicon Allowlist Policy

**Version:** v0.1  
**Scope:** What belongs in `acronym_allowlist.txt` vs the registry

---

## Hard Rule

> **Allowlist = ubiquitous infra primitives ONLY.**  
> **Domain acronyms MUST be registered.**  
> **Vendor proper nouns default to allowlist unless architecture is vendor-coupled.**

---

## Classification Matrix

| Category | Examples | Disposition |
|----------|----------|-------------|
| **Standards orgs** | ISO, IANA, IEEE, W3C | ALLOWLIST |
| **Data formats** | JSON, TSV, CSV, XML, YAML | ALLOWLIST |
| **Network protocols** | HTTP, HTTPS, TLS, SSH, TCP, UDP | ALLOWLIST |
| **Crypto primitives** | AES, RSA, ECC, SHA, HMAC, SHA-256, BLAKE3 | ALLOWLIST |
| **Web tech** | HTML, CSS, DOM, CORS, CDN, SSE | ALLOWLIST |
| **System resources** | CPU, GPU, RAM, UUID | ALLOWLIST |
| **Time/standards** | UTC, ISO-8601, POSIX | ALLOWLIST |
| **RFC 2119 keywords** | MUST, SHOULD, MAY | REGISTER (normative weight) |
| **Bus message types** | PROPOSAL, ACK, STATUS, BLOCKED, DECISION, QUESTION, MILESTONE | REGISTER |
| **IDP concepts** | IDP, DCTX, DCT, CONTRACT, INTENT, EVIDENCE, ATTEST | REGISTER |
| **Assurance states** | VALID, INVALID, VERIFIED, PROPOSED, ISSUED | REGISTER |
| **System/product** | HUMMBL, AAA, CAES, MRCC | REGISTER |
| **Domain discipline** | AI, LLM, HCI, SRE | REGISTER |
| **Vendor proper nouns** | CLAUDE, OPENAI, ANTHROPIC | ALLOWLIST (unless vendor-coupled arch) |
| **Test/placeholder IDs** | I1, T1, TB1, US-1, CO1 | ALLOWLIST (ephemeral) |
| **Table cell noise** | AND, ONLY, NOT, DETAIL, DESIGN | ALLOWLIST (false positive) |

---

## Decision Procedure

1. **Is it a standards body or ubiquitous format/protocol?** → ALLOWLIST
2. **Is it a domain term in your specs/governance?** → REGISTER
3. **Is it a vendor name used incidentally?** → ALLOWLIST
4. **Is it a table cell / heading artifact?** → ALLOWLIST (or fix regex)
5. **Is it ambiguous?** → Default to REGISTER (preserves governance value)

---

## Forbidden (Anti-Patterns)

- ❌ Adding domain terms to allowlist to "fix" CI quickly
- ❌ Registering vendor proper nouns without architectural justification
- ❌ Allowlisting RFC 2119 keywords (they're normative)
- ❌ Mixing hyphenated variants inconsistently

---

## Maintenance

When adding new entries:
1. Document rationale in commit message
2. Cross-reference relevant spec or doc where token appears
3. Prefer registration for any term that appears in normative text
