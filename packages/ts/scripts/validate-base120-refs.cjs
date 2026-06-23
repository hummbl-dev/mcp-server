#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INCLUDE_DIRS = [
  "agents",
  "commands",
  "skills",
  "docs",
  "packages",
  "src",
  "scripts"
];
const INCLUDE_FILES = ["README.md"];

const IGNORE_FILE = path.join(ROOT, ".base120ignore");
const BASE120_CODE_RE = /\b(P|IN|CO|DE|RE|SY)([1-9]|1[0-9]|20)\b/;
const BASE120_WORD_RE = /\bBase120\b/i;
const OVERRIDE_RE = /\bbase120-ok\b/i;

const bannedRules = [
  {
    label: "OODA",
    regex: /\bOODA\b/gi,
    requireCode: true,
  },
  {
    label: "OODA Loop",
    regex: /\bOODA Loop\b/gi,
    requireCode: true,
  },
  {
    label: "Hanlon's Razor",
    regex: /\bHanlon['’]s Razor\b/gi,
    requireCode: true,
  },
  {
    label: "Occam's Razor",
    regex: /\bOccam['’]s Razor\b|\bOccam\b/gi,
    requireCode: true,
  },
  {
    label: "First Principles",
    regex: /\bFirst Principles\b/gi,
    requireCode: true,
    allowName: /\bFirst Principles Framing\b/i,
    allowCode: /\bP1\b/,
    allowFileP1: true,
  },
  {
    label: "mental model(s)",
    regex: /\bmental models?\b/gi,
    allowBase120Word: true,
    allowFileCode: true,
    requireCode: true,
  },
  {
    label: "via negativa",
    regex: /\bvia negativa\b/gi,
    allowCode: /\bIN19\b/,
    allowFileIN19: true,
    requireCode: true,
  },
  {
    label: "premortem",
    regex: /\bpremortem\b/gi,
    allowCode: /\bIN2\b/,
    allowFileIN2: true,
    requireCode: true,
  },
];

const readIgnoreList = () => {
  if (!fs.existsSync(IGNORE_FILE)) return [];
  return fs
    .readFileSync(IGNORE_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};

const ignorePatterns = readIgnoreList();

const isIgnored = (relPath) => {
  for (const pattern of ignorePatterns) {
    if (pattern.startsWith("re:")) {
      const re = new RegExp(pattern.slice(3));
      if (re.test(relPath)) return true;
    } else if (relPath.includes(pattern)) {
      return true;
    }
  }
  return false;
};

const listFiles = (dir) => {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
};

const getLineCol = (text, index) => {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  const col = index - (lastNewline === -1 ? -1 : lastNewline);
  return { line, col };
};

const shouldAllow = (rule, windowText, fileContext) => {
  if (OVERRIDE_RE.test(windowText)) return true;
  if (rule.allowName && rule.allowName.test(windowText)) return true;
  if (rule.allowCode && rule.allowCode.test(windowText)) return true;
  if (rule.allowBase120Word && BASE120_WORD_RE.test(windowText)) return true;
  if (rule.allowBase120Word && fileContext.hasBase120Word) return true;
  if (rule.allowFileCode && fileContext.hasCode) return true;
  if (rule.allowFileP1 && fileContext.hasP1) return true;
  if (rule.allowFileIN2 && fileContext.hasIN2) return true;
  if (rule.allowFileIN19 && fileContext.hasIN19) return true;
  if (rule.requireCode && BASE120_CODE_RE.test(windowText)) return true;
  return false;
};

const violations = [];

const includeFiles = [];
for (const dir of INCLUDE_DIRS) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) {
    includeFiles.push(...listFiles(full));
  }
}
for (const file of INCLUDE_FILES) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) includeFiles.push(full);
}

for (const file of includeFiles) {
  const rel = path.relative(ROOT, file);
  if (isIgnored(rel)) continue;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue;

  const fileContext = {
    hasBase120Word: BASE120_WORD_RE.test(text),
    hasCode: BASE120_CODE_RE.test(text),
    hasP1: /\bP1\b/.test(text),
    hasIN2: /\bIN2\b/.test(text),
    hasIN19: /\bIN19\b/.test(text),
  };

  for (const rule of bannedRules) {
    let match;
    const regex = new RegExp(rule.regex);
    regex.lastIndex = 0;
    while ((match = regex.exec(text))) {
      const idx = match.index;
      const windowStart = Math.max(0, idx - 80);
      const windowEnd = Math.min(text.length, idx + match[0].length + 80);
      const windowText = text.slice(windowStart, windowEnd);
      if (shouldAllow(rule, windowText, fileContext)) continue;
      const { line, col } = getLineCol(text, idx);
      violations.push({
        file: rel,
        line,
        col,
        found: match[0],
        rule: rule.label,
      });
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(
      `${v.file}:${v.line}:${v.col} – Found "${v.found}" without Base120 reference`
    );
  }
  process.exit(1);
}

console.log("Base120 reference lint: OK");
