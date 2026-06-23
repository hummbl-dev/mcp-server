#!/usr/bin/env python3
"""MCP Server for the HUMMBL Unified Tier Framework.

Exposes problem classification, model recommendation, tier assessment,
and framework overview as MCP tools via stdio JSON-RPC.

Zero third-party dependencies. Uses only Python stdlib.

Usage:
    python3 mcp_server.py

Configure in Claude Code settings.json:
    {
      "mcpServers": {
        "hummbl-tier-framework": {
          "command": "python3",
          "args": ["path/to/mcp_server.py"]
        }
      }
    }
"""

import json
import re
import sys
import traceback

# ---------------------------------------------------------------------------
# Server metadata
# ---------------------------------------------------------------------------
SERVER_NAME = "hummbl-tier-framework"
SERVER_VERSION = "1.0.0"
PROTOCOL_VERSION = "2024-11-05"

# ---------------------------------------------------------------------------
# Framework data
# ---------------------------------------------------------------------------

TIER_DEFINITIONS = {
    1: {
        "name": "Simple",
        "score_range": "0-9",
        "definition": (
            "Problems with few variables, clear cause-effect relationships, "
            "and well-established solution methods. Solutions are repeatable "
            "and outcomes are predictable."
        ),
        "characteristics": {
            "stakeholder_alignment": "High agreement on both problem and solution",
            "information": "Complete, stable, and readily available",
            "solution_finality": "Problems can be definitively solved",
            "learning_curve": "Minimal; established procedures exist",
            "time_dynamics": "Low urgency; reversible if errors occur",
        },
        "examples": [
            "Fixing a flat tire",
            "Balancing a checkbook",
            "Following a recipe",
            "Replacing a light bulb",
        ],
        "base_n": "Base6",
        "approach": [
            "Apply standard operating procedures",
            "Use checklists and templates",
            "Minimal customization required",
            "Focus on efficiency and accuracy",
        ],
    },
    2: {
        "name": "Complicated",
        "score_range": "10-14",
        "definition": (
            "Problems with many interdependent parts requiring specialized "
            "expertise but following predictable patterns. Solutions exist "
            "but require coordination and technical knowledge."
        ),
        "characteristics": {
            "stakeholder_alignment": "Moderate agreement; some negotiation needed",
            "information": "Mostly complete; some gaps fillable through analysis",
            "solution_finality": "Problems can be solved with expert intervention",
            "learning_curve": "Moderate; requires training and experience",
            "time_dynamics": "Some urgency; mostly reversible with effort",
        },
        "examples": [
            "Building a bridge",
            "Implementing an ERP system",
            "Conducting a clinical trial",
            "Launching a satellite",
        ],
        "base_n": "Base12",
        "approach": [
            "Engage domain experts",
            "Break down into manageable components",
            "Use project management methodologies",
            "Coordinate across specializations",
        ],
    },
    3: {
        "name": "Complex",
        "score_range": "15-19",
        "definition": (
            "Problems with emergent behavior where outcomes are not predictable "
            "from initial conditions. Solutions require adaptive approaches "
            "and continuous learning."
        ),
        "characteristics": {
            "stakeholder_alignment": "Limited agreement; perspectives diverge significantly",
            "information": "Incomplete and changing; new information emerges during solving",
            "solution_finality": "Problems are managed rather than solved; require ongoing adaptation",
            "learning_curve": "High; understanding evolves through experimentation",
            "time_dynamics": "Moderate urgency; some irreversibility",
        },
        "examples": [
            "Organizational restructuring for scale",
            "Product-market fit discovery",
            "Ecosystem restoration",
            "Market entry strategy in emerging economies",
        ],
        "base_n": "Base24",
        "approach": [
            "Embrace experimentation and iteration",
            "Use sense-making frameworks",
            "Build feedback loops",
            "Expect emergence and surprise",
            "Maintain adaptive capacity",
        ],
    },
    4: {
        "name": "Wicked",
        "score_range": "20-24",
        "definition": (
            "Problems with fundamental stakeholder disagreement, no clear "
            "stopping rule, and every solution creating new problems. "
            "These problems resist traditional problem-solving approaches."
        ),
        "characteristics": {
            "stakeholder_alignment": "Deep disagreement on problem definition itself",
            "information": "Fundamentally incomplete; every solution reveals new aspects",
            "solution_finality": "No definitive solutions; every intervention is consequential",
            "learning_curve": "Very high; problem understanding evolves continuously",
            "time_dynamics": "Significant urgency; largely irreversible consequences",
        },
        "examples": [
            "Healthcare system reform",
            "Educational system transformation",
            "Urban planning and development",
            "Digital transformation strategy",
            "Climate adaptation at regional scale",
        ],
        "base_n": "Base36",
        "approach": [
            "Frame and reframe continuously",
            "Engage diverse stakeholders in co-creation",
            "Accept that solutions are political and value-laden",
            "Use portfolio approaches (multiple simultaneous experiments)",
            "Build resilience rather than seeking optimization",
        ],
    },
    5: {
        "name": "Super-Wicked",
        "score_range": "25-30",
        "definition": (
            "A subset of wicked problems with additional structural barriers: "
            "time is running out, no central authority exists, those seeking "
            "solutions are also causing the problem, and policies discount "
            "the future."
        ),
        "characteristics": {
            "stakeholder_alignment": "Fundamental disagreement compounded by conflicting incentives",
            "information": "Incomplete with irreducible uncertainty about future states",
            "solution_finality": "No solutions; only interventions that shift trajectories",
            "learning_curve": "Extreme; understanding requires multi-generational perspective",
            "time_dynamics": "Critical urgency with irreversible tipping points",
        },
        "examples": [
            "Global climate change",
            "Antimicrobial resistance",
            "Nuclear proliferation",
            "AI alignment and safety",
            "Ocean acidification",
        ],
        "base_n": "Base42 or BASE120",
        "approach": [
            "Accept fundamental uncertainty and irreversibility",
            "Build coalitions across traditional boundaries",
            "Design for long-term institutional commitment",
            "Create mechanisms to constrain present behavior for future benefit",
            "Integrate multiple frameworks and perspectives simultaneously",
            "Focus on trajectory shifts rather than endpoint solutions",
        ],
        "super_wicked_criteria": [
            "Time is running out: irreversible consequences approaching",
            "No central authority: no single entity can impose solutions",
            "Causers are solvers: those seeking solutions contribute to the problem",
            "Future discounting: policies favor present benefits over future costs",
        ],
    },
}

LEARNING_TIERS = {
    0: {
        "name": "Pre-Learning (Awareness)",
        "base_n": "Pre-Base6",
        "models_known": "0",
        "description": (
            "Awareness stage where individuals recognize the existence and "
            "potential value of mental models but have not yet begun "
            "systematic study or application."
        ),
        "time_investment": "Minimal; exploratory",
    },
    1: {
        "name": "Tool User (Beginner)",
        "base_n": "Base6",
        "models_known": "6-12",
        "description": (
            "Beginner stage where individuals learn to apply individual "
            "mental models to straightforward problems with guidance."
        ),
        "time_investment": "20-40 hours across 3-6 months",
    },
    2: {
        "name": "Integrator (Intermediate)",
        "base_n": "Base12-Base24",
        "models_known": "12-24",
        "description": (
            "Intermediate stage where individuals combine multiple mental "
            "models to address complicated problems."
        ),
        "time_investment": "60-120 hours across 6-12 months",
    },
    3: {
        "name": "Architect (Advanced)",
        "base_n": "Base24-Base36",
        "models_known": "24-36",
        "description": (
            "Advanced stage where individuals design systematic approaches "
            "to complex and wicked problems."
        ),
        "time_investment": "200-400 hours across 1-2 years",
    },
    4: {
        "name": "Creator (Master)",
        "base_n": "Base42-BASE120",
        "models_known": "36-120",
        "description": (
            "Mastery stage where individuals extend existing mental models "
            "or create entirely new ones."
        ),
        "time_investment": "500+ hours across 2-5+ years",
    },
}

SCORING_DIMENSIONS = {
    "stakeholder_agreement": {
        "question": "How much do stakeholders agree on the problem and solution?",
        "rubric": {
            "0": "Universal agreement on both problem and solution",
            "1-2": "High agreement; minor negotiation needed",
            "3-4": "Moderate disagreement; significant stakeholder management required",
            "5-6": "Fundamental disagreement on problem definition itself",
        },
    },
    "information_completeness": {
        "question": "How complete and stable is the information needed?",
        "rubric": {
            "0": "Complete, stable information; all variables known",
            "1-2": "Mostly complete; minor gaps fillable through analysis",
            "3-4": "Incomplete and changing; new information emerges during solving",
            "5-6": "Fundamentally incomplete; irreducible uncertainty about key factors",
        },
    },
    "solution_finality": {
        "question": "Can the problem be definitively solved or only managed?",
        "rubric": {
            "0": "Problem can be completely and permanently solved",
            "1-2": "Problem can be solved with expert intervention",
            "3-4": "Problem must be managed; requires ongoing adaptation",
            "5-6": "No definitive solution possible; only trajectory shifts",
        },
    },
    "learning_during_solving": {
        "question": "How much does understanding evolve during the solving process?",
        "rubric": {
            "0": "Problem fully understood before action; minimal learning needed",
            "1-2": "Moderate learning; understanding deepens with experience",
            "3-4": "High learning; problem understanding evolves significantly",
            "5-6": "Extreme learning; every intervention reveals new problem aspects",
        },
    },
    "time_pressure_irreversibility": {
        "question": "How urgent is action and how reversible are consequences?",
        "rubric": {
            "0": "No time pressure; fully reversible if errors occur",
            "1-2": "Some urgency; mostly reversible with effort",
            "3-4": "Moderate urgency; some irreversible consequences",
            "5-6": "Critical urgency; irreversible tipping points and time running out",
        },
    },
}

# ---------------------------------------------------------------------------
# BASE120 model registry
# ---------------------------------------------------------------------------

BASE120_MODELS = {
    "P": {
        "name": "Perspective",
        "purpose": "Frame and name what is",
        "models": {
            "P1": "First Principles - Break down to fundamental truths",
            "P2": "Stakeholder Mapping - Identify all affected parties",
            "P3": "Mental Models - Recognize thinking frameworks in use",
            "P4": "Lens Shifting - View from different perspectives",
            "P5": "Framing Effects - How presentation shapes perception",
            "P6": "Observer Bias - Account for subjective interpretation",
            "P7": "Perspective Taking - Adopt another's viewpoint",
            "P8": "Context Awareness - Situational factors that shape meaning",
            "P9": "Paradigm Shifts - Fundamental worldview changes",
            "P10": "Worldview Analysis - Core beliefs and assumptions",
            "P11": "Cultural Frames - How culture shapes interpretation",
            "P12": "Temporal Perspective - Time horizon effects",
            "P13": "Scale Perspective - Zoom in/out effects",
            "P14": "Systems Perspective - See interconnections",
            "P15": "Narrative Framing - Story shapes understanding",
            "P16": "Value Lenses - How values filter perception",
            "P17": "Disciplinary Perspectives - Field-specific views",
            "P18": "Ideological Frames - Political/philosophical lenses",
            "P19": "Emotional Perspective - Feeling-based interpretation",
            "P20": "Meta-Perspective - Awareness of perspective itself",
        },
    },
    "IN": {
        "name": "Inversion",
        "purpose": "Reverse assumptions",
        "models": {
            "IN1": "Inversion - Solve by considering opposite",
            "IN2": "Negative Space - What's NOT there matters",
            "IN3": "Via Negativa - Improve by removing, not adding",
            "IN4": "Antifragile - Gains from disorder",
            "IN5": "Reverse Engineering - Work backwards from end state",
            "IN6": "Contrapositive - If A then B, then not-B then not-A",
            "IN7": "Devil's Advocate - Argue against to strengthen",
            "IN8": "Premortem - Assume failure, work backwards",
            "IN9": "Opportunity Cost - What you give up",
            "IN10": "Negative Visualization - Imagine loss to appreciate",
            "IN11": "Subtraction - Remove to improve",
            "IN12": "Constraints as Enablers - Limits drive creativity",
            "IN13": "Counterfactual Thinking - What if opposite happened?",
            "IN14": "Reverse Mentoring - Junior teaches senior",
            "IN15": "Disconfirmation - Seek evidence against belief",
            "IN16": "Paradoxical Thinking - Embrace contradictions",
            "IN17": "Beginner's Mind - Un-learn to learn fresh",
            "IN18": "Negative Indicators - Absence as signal",
            "IN19": "Inverse Problems - Define by what it's not",
            "IN20": "Symmetry Breaking - Find asymmetric advantages",
        },
    },
    "CO": {
        "name": "Composition",
        "purpose": "Combine parts into wholes",
        "models": {
            "CO1": "Synergy - Whole greater than sum of parts",
            "CO2": "Emergence - New properties at higher levels",
            "CO3": "Integration - Combine disparate elements",
            "CO4": "Synthesis - Merge ideas into new whole",
            "CO5": "Modularity - Independent components compose",
            "CO6": "Ecosystem Thinking - Interconnected components",
            "CO7": "Value Chain - Sequential value addition",
            "CO8": "Layered Abstraction - Levels build on each other",
            "CO9": "Network Effects - Value increases with connections",
            "CO10": "Complementarity - Elements enhance each other",
            "CO11": "Bundling - Package for greater value",
            "CO12": "Cross-Pollination - Ideas from different domains",
            "CO13": "Convergence - Multiple paths to same solution",
            "CO14": "Gestalt - Pattern recognition in wholes",
            "CO15": "Compounding - Small additions accumulate",
            "CO16": "Scaffolding - Build support structures",
            "CO17": "Stack Thinking - Layer technologies/capabilities",
            "CO18": "Interfacing - Connect systems cleanly",
            "CO19": "Orchestration - Coordinate multiple components",
            "CO20": "Holistic Integration - Unify all elements",
        },
    },
    "DE": {
        "name": "Decomposition",
        "purpose": "Break wholes into components",
        "models": {
            "DE1": "Root Cause Analysis - Find fundamental cause",
            "DE2": "Divide and Conquer - Split problem into parts",
            "DE3": "Modularization - Separate into independent units",
            "DE4": "Abstraction Layers - Separate levels of detail",
            "DE5": "Critical Path - Identify essential sequence",
            "DE6": "Bottleneck Analysis - Find limiting constraint",
            "DE7": "Pareto Analysis - 80/20 rule, vital few",
            "DE8": "Failure Mode Analysis - How things can break",
            "DE9": "Decision Trees - Branch out possibilities",
            "DE10": "Value Stream Mapping - Trace value flow",
            "DE11": "Force Field Analysis - Driving vs restraining forces",
            "DE12": "SWOT Analysis - Strengths, Weaknesses, Opportunities, Threats",
            "DE13": "Work Breakdown Structure - Hierarchical task decomposition",
            "DE14": "Component Analysis - Individual element examination",
            "DE15": "Causal Chains - A causes B causes C",
            "DE16": "Dependency Mapping - What depends on what",
            "DE17": "Gap Analysis - Current vs desired state",
            "DE18": "Problem Disaggregation - Break into sub-problems",
            "DE19": "Segmentation - Divide into meaningful groups",
            "DE20": "Reductionism - Understand via simplest parts",
        },
    },
    "RE": {
        "name": "Recursion",
        "purpose": "Iterate, feedback, self-reference",
        "models": {
            "RE1": "Feedback Loops - Output influences input",
            "RE2": "Iterative Refinement - Successive improvements",
            "RE3": "Self-Reference - System refers to itself",
            "RE4": "Reflexivity - Observer affects observed",
            "RE5": "Recursion - Function calls itself",
            "RE6": "Fractal Thinking - Self-similarity at scales",
            "RE7": "Virtuous Cycles - Positive reinforcing loops",
            "RE8": "Vicious Cycles - Negative reinforcing loops",
            "RE9": "Compound Growth - Growth on growth",
            "RE10": "Homeostasis - Self-regulating equilibrium",
            "RE11": "Adaptation - Learning from feedback",
            "RE12": "Evolutionary Thinking - Iterate with selection",
            "RE13": "Bootstrapping - Self-starting process",
            "RE14": "Meta-Learning - Learning to learn",
            "RE15": "Autopoiesis - Self-creating systems",
            "RE16": "Strange Loops - Paradoxical self-reference",
            "RE17": "Circular Causality - A causes B causes A",
            "RE18": "Self-Fulfilling Prophecy - Belief creates reality",
            "RE19": "Second-Order Effects - Effects of effects",
            "RE20": "Infinite Regress - Endless nesting",
        },
    },
    "SY": {
        "name": "Meta-Systems",
        "purpose": "Coordinate systems-of-systems",
        "models": {
            "SY1": "Systems Thinking - See interconnections",
            "SY2": "Second-Order Thinking - Consequences of consequences",
            "SY3": "Butterfly Effect - Small changes, big impacts",
            "SY4": "Leverage Points - High-impact interventions",
            "SY5": "Unintended Consequences - Unpredicted outcomes",
            "SY6": "Complexity Theory - Emergent system behavior",
            "SY7": "Resilience - Ability to absorb shocks",
            "SY8": "Antifragility - Gains from volatility",
            "SY9": "Optionality - Value of choices",
            "SY10": "Black Swans - Rare, high-impact events",
            "SY11": "Red Queen Effect - Running to stay in place",
            "SY12": "Tragedy of Commons - Individual vs collective good",
            "SY13": "Cobra Effect - Solution worsens problem",
            "SY14": "Goodhart's Law - Measured metric loses meaning",
            "SY15": "Shifting Baselines - Changing reference points",
            "SY16": "Lindy Effect - Age predicts longevity",
            "SY17": "Ergodicity - Time vs ensemble averages differ",
            "SY18": "Path Dependence - History constrains future",
            "SY19": "Model Selection - Choose right mental model",
            "SY20": "Meta-Models - Models about models",
        },
    },
}

# Keyword signals for wickedness dimension estimation
_STAKEHOLDER_KEYWORDS = {
    "high": [
        "political", "public", "government", "community", "society",
        "stakeholder", "constituency", "voters", "citizens", "nations",
        "coalition", "lobby", "faction", "partisan", "ideology",
        "culture", "values", "ethics", "moral", "equity", "justice",
        "indigenous", "minority", "marginalized",
    ],
    "medium": [
        "team", "department", "organization", "client", "customer",
        "management", "board", "executive", "employees", "union",
        "vendor", "partner", "investor", "shareholders",
    ],
    "low": [
        "personal", "individual", "solo", "single", "myself", "my own",
    ],
}

_REVERSIBILITY_KEYWORDS = {
    "high": [
        "irreversible", "permanent", "extinction", "tipping point",
        "collapse", "catastroph", "existential", "genocide", "nuclear",
        "climate", "pandemic", "ecosystem", "biodiversity", "ocean",
        "deforestation", "pollution", "contamination",
    ],
    "medium": [
        "difficult to undo", "long-term", "infrastructure", "legacy",
        "migration", "transformation", "restructur", "reform",
        "regulation", "policy", "institutional", "systemic",
    ],
    "low": [
        "reversible", "undo", "rollback", "temporary", "experiment",
        "prototype", "pilot", "test", "trial", "iterative",
    ],
}

_CLARITY_KEYWORDS = {
    "high": [
        "unclear", "ambiguous", "contested", "no agreement", "undefined",
        "subjective", "perception", "perspective", "interpretation",
        "wicked", "ill-defined", "paradox", "dilemma", "contradictory",
    ],
    "medium": [
        "complex", "multifaceted", "nuanced", "emergent", "evolving",
        "dynamic", "uncertain", "incomplete", "partial",
    ],
    "low": [
        "clear", "well-defined", "straightforward", "obvious",
        "established", "standard", "routine", "procedure", "recipe",
        "checklist", "template", "known",
    ],
}

_TEMPORAL_KEYWORDS = {
    "high": [
        "urgent", "deadline", "crisis", "emergency", "running out",
        "time-sensitive", "irreversible", "tipping", "accelerat",
        "exponential", "generational", "century", "decade",
        "climate change", "global warming",
    ],
    "medium": [
        "schedule", "timeline", "quarter", "year", "milestone",
        "roadmap", "planning", "long-term", "medium-term",
    ],
    "low": [
        "no rush", "whenever", "flexible", "no deadline", "at leisure",
        "low priority", "backlog",
    ],
}

_INTERCONNECTED_KEYWORDS = {
    "high": [
        "global", "systemic", "interconnected", "ecosystem",
        "interdependent", "cascading", "ripple", "butterfly effect",
        "network", "supply chain", "geopolitical", "civilization",
        "cross-border", "transnational", "planetary",
    ],
    "medium": [
        "cross-functional", "multi-team", "organization-wide",
        "department", "integrated", "coupled", "dependent",
        "downstream", "upstream", "stakeholder",
    ],
    "low": [
        "isolated", "independent", "standalone", "contained",
        "local", "self-contained", "simple", "single",
    ],
}

# Models recommended per tier, ranked by relevance
_TIER_MODEL_RECOMMENDATIONS = {
    1: {
        "P": ["P1", "P5"],
        "IN": ["IN1", "IN9"],
        "CO": ["CO5", "CO7"],
        "DE": ["DE1", "DE2", "DE7"],
        "RE": ["RE2"],
        "SY": ["SY19"],
    },
    2: {
        "P": ["P1", "P2", "P4", "P8"],
        "IN": ["IN1", "IN5", "IN8", "IN9"],
        "CO": ["CO3", "CO5", "CO7", "CO18"],
        "DE": ["DE1", "DE2", "DE5", "DE6", "DE7", "DE13"],
        "RE": ["RE1", "RE2", "RE11"],
        "SY": ["SY1", "SY2", "SY19"],
    },
    3: {
        "P": ["P1", "P2", "P4", "P7", "P8", "P12", "P14"],
        "IN": ["IN1", "IN3", "IN7", "IN8", "IN12", "IN15", "IN17"],
        "CO": ["CO1", "CO2", "CO4", "CO6", "CO9", "CO12", "CO19"],
        "DE": ["DE1", "DE5", "DE6", "DE7", "DE8", "DE11", "DE16"],
        "RE": ["RE1", "RE2", "RE7", "RE8", "RE11", "RE12", "RE19"],
        "SY": ["SY1", "SY2", "SY4", "SY5", "SY6", "SY9", "SY19"],
    },
    4: {
        "P": ["P1", "P2", "P4", "P7", "P9", "P10", "P11", "P14", "P16", "P18"],
        "IN": ["IN1", "IN3", "IN7", "IN8", "IN12", "IN13", "IN15", "IN16", "IN17", "IN20"],
        "CO": ["CO1", "CO2", "CO4", "CO6", "CO9", "CO12", "CO13", "CO19", "CO20"],
        "DE": ["DE1", "DE5", "DE6", "DE7", "DE8", "DE9", "DE11", "DE15", "DE16", "DE17"],
        "RE": ["RE1", "RE4", "RE7", "RE8", "RE10", "RE11", "RE12", "RE17", "RE19"],
        "SY": ["SY1", "SY2", "SY3", "SY4", "SY5", "SY6", "SY7", "SY12", "SY13", "SY18"],
    },
    5: {
        "P": ["P1", "P2", "P4", "P7", "P9", "P10", "P11", "P12", "P14", "P16", "P18", "P20"],
        "IN": ["IN1", "IN3", "IN4", "IN7", "IN8", "IN12", "IN13", "IN15", "IN16", "IN17", "IN19", "IN20"],
        "CO": ["CO1", "CO2", "CO4", "CO6", "CO9", "CO12", "CO13", "CO14", "CO19", "CO20"],
        "DE": ["DE1", "DE5", "DE6", "DE7", "DE8", "DE9", "DE11", "DE15", "DE16", "DE17", "DE18"],
        "RE": ["RE1", "RE4", "RE5", "RE7", "RE8", "RE10", "RE11", "RE12", "RE15", "RE17", "RE19"],
        "SY": ["SY1", "SY2", "SY3", "SY4", "SY5", "SY6", "SY7", "SY8", "SY10", "SY12", "SY13", "SY17", "SY18", "SY20"],
    },
}


# ---------------------------------------------------------------------------
# Keyword analysis engine
# ---------------------------------------------------------------------------

def _score_dimension(text, keyword_map):
    """Score a wickedness dimension 0-6 based on keyword presence."""
    text_lower = text.lower()
    high_hits = sum(1 for kw in keyword_map.get("high", []) if kw in text_lower)
    medium_hits = sum(1 for kw in keyword_map.get("medium", []) if kw in text_lower)
    low_hits = sum(1 for kw in keyword_map.get("low", []) if kw in text_lower)

    # High keywords push score up, low keywords push it down
    if high_hits >= 3:
        base = 5
    elif high_hits >= 1:
        base = 4
    elif medium_hits >= 3:
        base = 3
    elif medium_hits >= 1:
        base = 2
    elif low_hits >= 1:
        base = 1
    else:
        base = 2  # Default to moderate if no signals

    # Low-complexity signals reduce score
    if low_hits >= 2 and high_hits == 0:
        base = max(0, base - 2)
    elif low_hits >= 1 and high_hits == 0:
        base = max(0, base - 1)

    return min(6, max(0, base))


def _classify_problem_text(text):
    """Classify a problem description into tier + wickedness scores."""
    stakeholder = _score_dimension(text, _STAKEHOLDER_KEYWORDS)
    reversibility = _score_dimension(text, _REVERSIBILITY_KEYWORDS)
    clarity = _score_dimension(text, _CLARITY_KEYWORDS)
    temporal = _score_dimension(text, _TEMPORAL_KEYWORDS)
    interconnected = _score_dimension(text, _INTERCONNECTED_KEYWORDS)

    total = stakeholder + reversibility + clarity + temporal + interconnected

    if total <= 9:
        tier = 1
    elif total <= 14:
        tier = 2
    elif total <= 19:
        tier = 3
    elif total <= 24:
        tier = 4
    else:
        tier = 5

    return {
        "tier": tier,
        "tier_name": TIER_DEFINITIONS[tier]["name"],
        "total_score": total,
        "score_range": f"0-30 (this problem: {total})",
        "dimensions": {
            "stakeholder_diversity": {
                "score": stakeholder,
                "max": 6,
                "description": "Degree of stakeholder disagreement",
            },
            "solution_reversibility": {
                "score": reversibility,
                "max": 6,
                "description": "Irreversibility of consequences",
            },
            "problem_definition_clarity": {
                "score": clarity,
                "max": 6,
                "description": "Ambiguity in problem definition",
            },
            "temporal_dynamics": {
                "score": temporal,
                "max": 6,
                "description": "Time pressure and urgency",
            },
            "interconnectedness": {
                "score": interconnected,
                "max": 6,
                "description": "System interdependencies",
            },
        },
        "tier_definition": TIER_DEFINITIONS[tier]["definition"],
        "recommended_base_n": TIER_DEFINITIONS[tier]["base_n"],
        "recommended_approach": TIER_DEFINITIONS[tier]["approach"],
        "note": (
            "Scores are estimated via keyword analysis of the problem "
            "description. For precise classification, use the tier_assessment "
            "tool with manual scores for each dimension."
        ),
    }


def _score_to_tier(total):
    """Convert a 0-30 score to tier 1-5."""
    if total <= 9:
        return 1
    elif total <= 14:
        return 2
    elif total <= 19:
        return 3
    elif total <= 24:
        return 4
    else:
        return 5


def _score_to_learning_tier(total):
    """Map problem complexity score to a suggested learning tier."""
    if total <= 9:
        return 1
    elif total <= 14:
        return 2
    elif total <= 19:
        return 3
    else:
        return 4


def _get_model_recommendations(tier):
    """Get recommended BASE120 models for a given tier."""
    recs = _TIER_MODEL_RECOMMENDATIONS.get(tier, _TIER_MODEL_RECOMMENDATIONS[3])
    result = {}
    for transformation_key, model_ids in recs.items():
        t_data = BASE120_MODELS[transformation_key]
        result[transformation_key] = {
            "transformation": t_data["name"],
            "purpose": t_data["purpose"],
            "recommended_models": [
                {"id": mid, "description": t_data["models"][mid]}
                for mid in model_ids
                if mid in t_data["models"]
            ],
        }
    return result


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "classify_problem",
        "description": (
            "Classify a problem's complexity using HUMMBL's Unified Tier "
            "Framework. Analyzes the problem description to estimate wickedness "
            "across 5 dimensions (stakeholder diversity, solution reversibility, "
            "problem definition clarity, temporal dynamics, interconnectedness) "
            "and assigns a tier from 1 (Simple) to 5 (Super-Wicked)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "problem_description": {
                    "type": "string",
                    "description": (
                        "A text description of the problem to classify. "
                        "More detail yields more accurate classification."
                    ),
                },
            },
            "required": ["problem_description"],
        },
    },
    {
        "name": "recommend_models",
        "description": (
            "Recommend BASE120 mental models for a given problem tier or "
            "problem description. Returns models from all 6 transformations "
            "(Perspective, Inversion, Composition, Decomposition, Recursion, "
            "Meta-Systems) ranked by relevance to the tier."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "tier": {
                    "type": "integer",
                    "description": "Problem complexity tier (1-5). If omitted, provide problem_description instead.",
                    "minimum": 1,
                    "maximum": 5,
                },
                "problem_description": {
                    "type": "string",
                    "description": "A problem description to classify first, then recommend models for. Used if tier is not provided.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "tier_assessment",
        "description": (
            "Perform a full HUMMBL wickedness assessment given manual scores "
            "for 5 dimensions (0-6 each). Returns total score, tier "
            "classification, recommended approach, Base-N mapping, and "
            "suggested learning tier."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "stakeholder_agreement": {
                    "type": "integer",
                    "description": "Stakeholder agreement score (0=universal agreement, 6=fundamental disagreement)",
                    "minimum": 0,
                    "maximum": 6,
                },
                "information_completeness": {
                    "type": "integer",
                    "description": "Information completeness score (0=complete and stable, 6=fundamentally incomplete)",
                    "minimum": 0,
                    "maximum": 6,
                },
                "solution_finality": {
                    "type": "integer",
                    "description": "Solution finality score (0=permanently solvable, 6=no definitive solution possible)",
                    "minimum": 0,
                    "maximum": 6,
                },
                "learning_during_solving": {
                    "type": "integer",
                    "description": "Learning during solving score (0=fully understood beforehand, 6=extreme learning required)",
                    "minimum": 0,
                    "maximum": 6,
                },
                "time_pressure_irreversibility": {
                    "type": "integer",
                    "description": "Time pressure and irreversibility score (0=no pressure/fully reversible, 6=critical urgency/irreversible tipping points)",
                    "minimum": 0,
                    "maximum": 6,
                },
            },
            "required": [
                "stakeholder_agreement",
                "information_completeness",
                "solution_finality",
                "learning_during_solving",
                "time_pressure_irreversibility",
            ],
        },
    },
    {
        "name": "framework_overview",
        "description": (
            "Get a complete overview of the HUMMBL Unified Tier Framework "
            "including all 5 problem complexity tiers, 5 learning progression "
            "tiers, Base-N architecture mapping, and the scoring methodology."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------
def handle_tool(name, arguments):
    """Dispatch a tool call to the appropriate handler."""

    if name == "classify_problem":
        desc = arguments.get("problem_description", "")
        if not desc.strip():
            return {"error": "problem_description is required and must be non-empty"}
        return _classify_problem_text(desc)

    elif name == "recommend_models":
        tier = arguments.get("tier")
        desc = arguments.get("problem_description", "")

        if tier is not None:
            if not (1 <= tier <= 5):
                return {"error": f"tier must be 1-5, got {tier}"}
        elif desc.strip():
            classification = _classify_problem_text(desc)
            tier = classification["tier"]
        else:
            return {"error": "Provide either tier (1-5) or problem_description"}

        tier_info = TIER_DEFINITIONS[tier]
        recommendations = _get_model_recommendations(tier)
        total_models = sum(
            len(t["recommended_models"]) for t in recommendations.values()
        )

        result = {
            "tier": tier,
            "tier_name": tier_info["name"],
            "recommended_base_n": tier_info["base_n"],
            "total_recommended_models": total_models,
            "transformations": recommendations,
        }

        if desc.strip() and arguments.get("tier") is None:
            result["classified_from_description"] = True
            result["classification_note"] = (
                "Tier was inferred from problem description via keyword analysis."
            )

        return result

    elif name == "tier_assessment":
        scores = {
            "stakeholder_agreement": arguments["stakeholder_agreement"],
            "information_completeness": arguments["information_completeness"],
            "solution_finality": arguments["solution_finality"],
            "learning_during_solving": arguments["learning_during_solving"],
            "time_pressure_irreversibility": arguments["time_pressure_irreversibility"],
        }

        # Validate ranges
        for dim, val in scores.items():
            if not (0 <= val <= 6):
                return {"error": f"{dim} must be 0-6, got {val}"}

        total = sum(scores.values())
        tier = _score_to_tier(total)
        learning_tier = _score_to_learning_tier(total)
        tier_info = TIER_DEFINITIONS[tier]
        learning_info = LEARNING_TIERS[learning_tier]

        result = {
            "total_score": total,
            "max_score": 30,
            "tier": tier,
            "tier_name": tier_info["name"],
            "tier_definition": tier_info["definition"],
            "dimension_scores": {},
            "recommended_base_n": tier_info["base_n"],
            "recommended_approach": tier_info["approach"],
            "learning_tier": {
                "tier": learning_tier,
                "name": learning_info["name"],
                "base_n": learning_info["base_n"],
                "models_known": learning_info["models_known"],
                "description": learning_info["description"],
            },
        }

        dim_names = [
            ("stakeholder_agreement", "Stakeholder Agreement"),
            ("information_completeness", "Information Completeness"),
            ("solution_finality", "Solution Finality"),
            ("learning_during_solving", "Learning During Solving"),
            ("time_pressure_irreversibility", "Time Pressure & Irreversibility"),
        ]
        for key, label in dim_names:
            dim_info = SCORING_DIMENSIONS[key]
            result["dimension_scores"][key] = {
                "label": label,
                "score": scores[key],
                "max": 6,
                "question": dim_info["question"],
            }

        # Boundary warning
        boundaries = {9: (1, 2), 14: (2, 3), 19: (3, 4), 24: (4, 5)}
        for boundary, (low_tier, high_tier) in boundaries.items():
            if abs(total - boundary) <= 1:
                result["boundary_note"] = (
                    f"Score {total} is near the Tier {low_tier}/{high_tier} "
                    f"boundary ({boundary}). Consider context and domain-specific "
                    f"factors for final classification."
                )
                break

        return result

    elif name == "framework_overview":
        return {
            "framework": "HUMMBL Unified Tier Framework v1.0",
            "description": (
                "A comprehensive system for classifying problem complexity, "
                "mapping learning progression, and selecting appropriate "
                "mental model combinations for systematic problem-solving."
            ),
            "problem_complexity_tiers": {
                str(k): {
                    "name": v["name"],
                    "score_range": v["score_range"],
                    "definition": v["definition"],
                    "base_n": v["base_n"],
                    "examples": v["examples"],
                }
                for k, v in TIER_DEFINITIONS.items()
            },
            "learning_progression_tiers": {
                str(k): {
                    "name": v["name"],
                    "base_n": v["base_n"],
                    "models_known": v["models_known"],
                    "description": v["description"],
                    "time_investment": v["time_investment"],
                }
                for k, v in LEARNING_TIERS.items()
            },
            "base_n_mapping": {
                "Base6": {"models": 6, "problem_tiers": "1-2", "learning_tier": "1 (Tool User)"},
                "Base12": {"models": 12, "problem_tiers": "2-3", "learning_tier": "2 (Integrator)"},
                "Base24": {"models": 24, "problem_tiers": "3-4", "learning_tier": "2-3 (Integrator to Architect)"},
                "Base36": {"models": 36, "problem_tiers": "4-5", "learning_tier": "3-4 (Architect to Creator)"},
                "Base42": {"models": 42, "problem_tiers": "5", "learning_tier": "4 (Creator)"},
                "BASE120": {"models": 120, "problem_tiers": "All", "learning_tier": "4 (Creator) + Research"},
            },
            "scoring_methodology": {
                "total_range": "0-30 points",
                "dimensions": {
                    k: {"question": v["question"], "range": "0-6"}
                    for k, v in SCORING_DIMENSIONS.items()
                },
                "tier_boundaries": {
                    "Tier 1 (Simple)": "0-9",
                    "Tier 2 (Complicated)": "10-14",
                    "Tier 3 (Complex)": "15-19",
                    "Tier 4 (Wicked)": "20-24",
                    "Tier 5 (Super-Wicked)": "25-30",
                },
            },
            "transformations": {
                k: {"name": v["name"], "purpose": v["purpose"], "model_count": len(v["models"])}
                for k, v in BASE120_MODELS.items()
            },
        }

    else:
        return {"error": f"Unknown tool: {name}"}


# ---------------------------------------------------------------------------
# JSON-RPC protocol
# ---------------------------------------------------------------------------
def send_response(msg_id, result):
    """Send a JSON-RPC response to stdout."""
    response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
    out = json.dumps(response)
    sys.stdout.write(out + "\n")
    sys.stdout.flush()


def send_error(msg_id, code, message):
    """Send a JSON-RPC error to stdout."""
    response = {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": code, "message": message},
    }
    out = json.dumps(response)
    sys.stdout.write(out + "\n")
    sys.stdout.flush()


def main():
    """Main stdio JSON-RPC loop implementing MCP protocol."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})

        try:
            if method == "initialize":
                send_response(msg_id, {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "version": SERVER_VERSION,
                    },
                })

            elif method == "notifications/initialized":
                pass

            elif method == "tools/list":
                send_response(msg_id, {"tools": TOOLS})

            elif method == "tools/call":
                tool_name = params.get("name", "")
                arguments = params.get("arguments", {})
                result = handle_tool(tool_name, arguments)
                send_response(msg_id, {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(result, indent=2, default=str),
                        }
                    ],
                })

            elif method == "ping":
                send_response(msg_id, {})

            else:
                send_error(msg_id, -32601, f"Method not found: {method}")

        except Exception as e:
            send_error(
                msg_id,
                -32603,
                f"Internal error: {e}\n{traceback.format_exc()}",
            )


if __name__ == "__main__":
    main()
