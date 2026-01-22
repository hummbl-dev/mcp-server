# HUMMBL MCP Server

Model Context Protocol server providing access to the HUMMBL Base120 mental models framework.

[![CI](https://github.com/hummbl-dev/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/hummbl-dev/mcp-server/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@hummbl%2Fmcp-server.svg)](https://www.npmjs.com/package/@hummbl/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<a href="https://glama.ai/mcp/servers/@hummbl-dev/mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@hummbl-dev/mcp-server/badge" alt="HUMMBL Server MCP server" />
</a>

## Overview

HUMMBL Base120 is a comprehensive cognitive framework consisting of 120 validated mental models organized across 6 transformations:

- P (Perspective): Change viewpoint to see problems differently
- IN (Inversion): Flip problem to find solution by avoiding failure
- CO (Composition): Combine elements to create emergent properties
- DE (Decomposition): Break down complexity into manageable components
- RE (Recursion): Apply patterns at multiple scales and iterations
- SY (Meta-Systems): Understand rules, patterns, and systems governing systems

## Installation

### Global Installation (Recommended)

```bash
npm install -g @hummbl/mcp-server
```

### Using npx (No Installation Required)

```bash
npx @hummbl/mcp-server
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hummbl": {
      "command": "npx",
      "args": ["-y", "@hummbl/mcp-server"]
    }
  }
}
```

### `get_methodology`

Retrieve the canonical Self-Dialectical AI Systems methodology, including all stages and HUMMBL Base120 references.

Example:

```json
{}
```

### `audit_model_references`

Audit a list of HUMMBL model references for validity, duplication, and transformation alignment.

Example:

```json
{
  "items": [
    { "code": "IN11", "expectedTransformation": "IN" },
    { "code": "CO4" }
  ]
}
```

After configuration, restart Claude Desktop. The HUMMBL tools will appear in the attachment menu.

## Available Tools

### `get_model`

Retrieve detailed information about a specific mental model.

Example:

```json
{
  "code": "P1"
}
```

### `list_all_models`

List all 120 mental models, optionally filtered by transformation type.

Example:

```json
{
  "transformation_filter": "P"
}
```

### `search_models`

Search models by keyword across names, descriptions, and examples.

Example:

```json
{
  "query": "decision"
}
```

### `recommend_models`

Get AI-recommended models based on problem description.

Example:

```json
{
  "problem_description": "Our startup is growing rapidly but systems are breaking down. We need to scale operations without losing quality."
}
```

### `get_transformation`

Retrieve information about a specific transformation type and all its models.

Example:

```json
{
  "type": "IN"
}
```

### `search_problem_patterns`

Find pre-defined problem patterns with recommended approaches.

Example:

```json
{
  "query": "innovation"
}
```

## Usage Examples

### Example 1: Getting a Specific Model

**Scenario**: You want to understand "First Principles Thinking" before applying it to a problem.

```json
// Request
{
  "tool": "get_model",
  "arguments": {
    "code": "P1"
  }
}

// Response
{
  "model": {
    "code": "P1",
    "name": "First Principles Framing",
    "definition": "Reduce complex problems to foundational truths that cannot be further simplified",
    "priority": 1,
    "transformation": "P"
  }
}
```

**When to use**: Starting a new problem analysis by identifying core assumptions and fundamentals.

---

### Example 2: Listing Models by Transformation

**Scenario**: You know you need to look at a problem from different perspectives but want to see all available perspective models.

```json
// Request
{
  "tool": "list_all_models",
  "arguments": {
    "transformation_filter": "P"
  }
}

// Response
{
  "total": 20,
  "models": [
    {
      "code": "P1",
      "name": "First Principles Framing",
      "definition": "Reduce complex problems to foundational truths...",
      "priority": 1,
      "transformation": "P"
    },
    {
      "code": "P2",
      "name": "Stakeholder Mapping",
      "definition": "Identify all parties with interest, influence...",
      "priority": 1,
      "transformation": "P"
    }
    // ... 18 more models
  ]
}
```

**When to use**: Exploring all models within a specific transformation category to find the right approach.

---

### Example 3: Searching for Decision-Related Models

**Scenario**: You're making a strategic decision and want to find all mental models related to decision-making.

```json
// Request
{
  "tool": "search_models",
  "arguments": {
    "query": "decision"
  }
}

// Response
{
  "query": "decision",
  "resultCount": 8,
  "results": [
    {
      "code": "P2",
      "name": "Stakeholder Mapping",
      "definition": "Identify all parties with interest, influence, or impact in a system or decision",
      "priority": 1,
      "transformation": "P"
    },
    {
      "code": "SY3",
      "name": "Decision Trees & Game Theory",
      "definition": "Model sequential choices and strategic interactions with payoff structures",
      "priority": 1,
      "transformation": "SY"
    }
    // ... 6 more results
  ]
}
```

**When to use**: Finding relevant models across all transformations for a specific concept or challenge.

---

### Example 4: Getting Recommendations for a Complex Problem

**Scenario**: Your startup is scaling rapidly but systems are breaking down—you need guidance on which mental models to apply.

```json
// Request
{
  "tool": "recommend_models",
  "arguments": {
    "problem": "Our startup is growing rapidly but systems are breaking down. We need to scale operations without losing quality."
  }
}

// Response
{
  "problem": "Our startup is growing rapidly but systems are breaking down...",
  "recommendationCount": 2,
  "recommendations": [
    {
      "pattern": "Complex system to understand",
      "transformations": [
        {
          "key": "DE",
          "name": "Decomposition",
          "description": "Break down complexity into manageable components"
        }
      ],
      "topModels": [
        {
          "code": "DE1",
          "name": "Modular Decomposition",
          "definition": "Break systems into independent, interchangeable components...",
          "priority": 1
        },
        {
          "code": "DE2",
          "name": "Layered Architecture",
          "definition": "Organize systems into hierarchical strata with clear interfaces",
          "priority": 1
        }
      ]
    },
    {
      "pattern": "Strategic or coordination challenge",
      "transformations": [
        {
          "key": "SY",
          "name": "Meta-Systems",
          "description": "Understand rules, patterns, and systems governing systems"
        }
      ],
      "topModels": [
        {
          "code": "SY1",
          "name": "Feedback Loops & Causality",
          "definition": "Trace how outputs loop back as inputs creating reinforcing or balancing dynamics",
          "priority": 1
        }
      ]
    }
  ]
}
```

**When to use**: You have a complex, multi-faceted problem and need AI-driven recommendations on where to start.

---

### Example 5: Exploring the Inversion Transformation

**Scenario**: You've heard about "inversion thinking" and want to understand all the models in that category.

```json
// Request
{
  "tool": "get_transformation",
  "arguments": {
    "key": "IN"
  }
}

// Response
{
  "key": "IN",
  "name": "Inversion",
  "description": "Reverse assumptions. Examine opposites, edges, negations.",
  "modelCount": 20,
  "models": [
    {
      "code": "IN1",
      "name": "Subtractive Thinking",
      "definition": "Improve systems by removing elements rather than adding complexity",
      "priority": 1
    },
    {
      "code": "IN2",
      "name": "Premortem Analysis",
      "definition": "Assume failure has occurred and work backward to identify causes",
      "priority": 1
    }
    // ... 18 more models
  ]
}
```

**When to use**: Deep-diving into a transformation to understand its philosophy and available models.

---

### Example 6: Finding Problem Patterns

**Scenario**: Your team struggles with innovation—everything feels incremental. You want to find pre-defined patterns that match this challenge.

```json
// Request
{
  "tool": "search_problem_patterns",
  "arguments": {
    "query": "innovation"
  }
}

// Response
{
  "query": "innovation",
  "patternCount": 1,
  "patterns": [
    {
      "pattern": "Stuck in conventional thinking",
      "transformations": ["IN"],
      "topModels": ["IN1", "IN2", "IN3"]
    }
  ]
}
```

**When to use**: You recognize a common problem type and want to quickly jump to the recommended mental models and approaches.

---

## Guided Workflows (NEW in Phase 2)

HUMMBL now includes guided multi-turn workflows that walk you through systematic problem-solving using mental models. Perfect for complex problems that benefit from structured analysis.

### Available Workflows

#### 1. Root Cause Analysis
**Use when**: Investigating failures, incidents, or recurring problems
**Duration**: 20-30 minutes
**Sequence**: P → IN → DE → SY

Systematically find root causes, not just symptoms.

#### 2. Strategy Design
**Use when**: Creating strategies, planning initiatives, entering markets
**Duration**: 30-45 minutes
**Sequence**: P → CO → SY → RE

Design comprehensive strategies with creative combinations and systemic thinking.

#### 3. Decision Making
**Use when**: High-stakes decisions with uncertainty
**Duration**: 15-25 minutes
**Sequence**: P → IN → SY → RE

Make quality decisions through clear framing, stress-testing, and systematic evaluation.

### Workflow Tools

#### `list_workflows`
List all available guided workflows.

```json
{
  "tool": "list_workflows"
}
```

#### `start_workflow`
Begin a guided workflow for your problem.

```json
{
  "tool": "start_workflow",
  "arguments": {
    "workflow_name": "root_cause_analysis",
    "problem_description": "Our production API started failing intermittently after yesterday's deployment"
  }
}
```

#### `continue_workflow`
Proceed to the next step after completing current step.

```json
{
  "tool": "continue_workflow",
  "arguments": {
    "workflow_name": "root_cause_analysis",
    "current_step": 1,
    "step_insights": "Identified 3 affected stakeholders: customers experiencing timeouts, internal services with cascading failures, and ops team receiving alerts. Core assumption: the deployment changed something fundamental in request handling."
  }
}
```

#### `find_workflow_for_problem`
Discover which workflow best fits your problem.

```json
{
  "tool": "find_workflow_for_problem",
  "arguments": {
    "problem_keywords": "system failure production"
  }
}
```

### Example: Root Cause Analysis Workflow

**Step 1 (Perspective)**:
```json
{
  "currentStep": 1,
  "totalSteps": 4,
  "transformation": "P",
  "guidance": "Frame the problem clearly from multiple perspectives",
  "suggestedModels": ["P1", "P2", "P15"],
  "questions": [
    "What are the foundational facts we know for certain?",
    "Who is affected and how?",
    "What assumptions are we making?"
  ]
}
```

**After completing Step 1, continue:**
```json
{
  "tool": "continue_workflow",
  "arguments": {
    "workflow_name": "root_cause_analysis",
    "current_step": 1,
    "step_insights": "Your insights here..."
  }
}
```

**Step 2 (Inversion)**: Test boundaries, work backward from failure
**Step 3 (Decomposition)**: Isolate the failing component
**Step 4 (Meta-Systems)**: Design systemic fixes and prevention

---

## Available Resources

Direct URI-based access to models and transformations:

- `hummbl://model/{code}` – Individual model (e.g., `hummbl://model/P1`)
- `hummbl://transformation/{type}` – All models in transformation (e.g., `hummbl://transformation/P`)
- `hummbl://models` – Complete Base120 framework
- `hummbl://methodology/self-dialectical-ai` – Structured Self-Dialectical AI methodology definition
- `hummbl://methodology/self-dialectical-ai/overview` – Markdown overview of the methodology for quick operator reference

### Self-Dialectical Methodology Overview

The HUMMBL Self-Dialectical AI Systems methodology (v1.2) enables ethical self-correction via five dialectical stages (thesis, antithesis, synthesis, convergence, meta-reflection) mapped to Base120 mental models plus SY meta-models. Use the tools/resources above to fetch the canonical JSON definition, Markdown overview, or to audit references in external documents.

## Problem Patterns

HUMMBL includes pre-defined problem patterns that map common challenges to recommended transformations and models. See [Problem Patterns Documentation](./docs/problem-patterns.md) for the complete catalog with detailed guidance.

## Problem Patterns

HUMMBL includes pre-defined problem patterns that map common challenges to recommended transformations and models. See [Problem Patterns Documentation](./docs/problem-patterns.md) for the complete catalog with detailed guidance.

## Development

### Setup

```bash
git clone https://github.com/hummbl-dev/mcp-server.git
cd mcp-server
npm install
```

### Build

```bash
npm run build
```

### Run Locally

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

## Architecture

```text
src/
├── index.ts              # stdio entry point
├── server.ts             # Server configuration
├── framework/
│   └── base120.ts        # Complete mental models database
├── tools/
│   └── models.ts         # Tool registrations
├── resources/
│   └── models.ts         # Resource endpoints
├── types/
│   └── domain.ts         # Core type definitions
└── utils/
    └── result.ts         # Result pattern utilities
```

## License

MIT © HUMMBL, LLC

## Version

1.0.0-beta.1