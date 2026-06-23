# Lexicon JSON Canonicalization Rules

**Version:** v0.1.0  
**Purpose:** Deterministic serialization for checksum stability

---

## Format Rules

1. **Encoding:** UTF-8, no BOM
2. **Indentation:** 2 spaces (no tabs)
3. **Line endings:** LF (`\n`)
4. **Trailing newline:** Required

## JSON Structure Rules

1. **Object key order:** Sorted alphabetically (Python `json.dumps(..., sort_keys=True)`)
2. **Array order:** Preserved as authored
3. **Null values:** Explicit `null` (not omitted)
4. **Booleans:** lowercase `true`/`false`
5. **Numbers:** No leading `+`, no trailing `.0` unless needed

## Deterministic Checksums

To verify:

```bash
# macOS
shasum -a 256 governance/lexicon/acronyms.v0.1.json

# Linux
sha256sum governance/lexicon/acronyms.v0.1.json
```

Python equivalent:

```python
import hashlib, json
with open("acronyms.v0.1.json", "rb") as f:
    print(hashlib.sha256(f.read()).hexdigest())
```

## Stability Guarantee

Files matching these rules will produce identical checksums across:
- macOS / Linux / Windows (WSL)
- Python 3.10+ / Node / jq
- Git checkout (assuming `core.autocrlf=input`)

---

## Validation

```bash
python3 -c "
import json
with open('governance/lexicon/acronyms.v0.1.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('Valid JSON')
print(f'Keys: {list(data.keys())}')
print(f'Acronyms: {len(data[\"acronyms\"])}')
"
```
