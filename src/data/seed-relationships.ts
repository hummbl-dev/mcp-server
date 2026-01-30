// Seed relationships data
// 10 validated relationships between mental models
// Used to bootstrap the relationship validation system

import type { RelationshipInput } from "../types/relationships.js";

export const SEED_RELATIONSHIPS: RelationshipInput[] = [
  {
    source_code: "DE1",
    target_code: "DE7",
    relationship_type: "enables",
    confidence: "B",
    evidence:
      "First Principles provides the foundational decomposition skill that Root Cause Analysis depends on for systematic problem breakdown.",
  },
  {
    source_code: "P1",
    target_code: "P5",
    relationship_type: "reinforces",
    confidence: "A",
    evidence:
      "Second-Order Thinking and Circle of Competence are complementary - understanding what you know enables better anticipation of second-order effects.",
  },
  {
    source_code: "IN1",
    target_code: "IN3",
    relationship_type: "sequences",
    confidence: "B",
    evidence:
      "Mental Models as a framework typically precedes the development of a Personal Latticework - you need the concept before building your collection.",
  },
  {
    source_code: "CO1",
    target_code: "CO2",
    relationship_type: "complements",
    confidence: "A",
    evidence:
      "Margin of Safety and Probabilistic Thinking work together - understanding probabilities helps determine appropriate safety margins.",
  },
  {
    source_code: "RE1",
    target_code: "RE3",
    relationship_type: "enables",
    confidence: "B",
    evidence:
      "Systems Thinking enables understanding of Feedback Loops - recognizing interconnected systems is prerequisite to understanding dynamic feedback.",
  },
  {
    source_code: "SY1",
    target_code: "SY2",
    relationship_type: "contains",
    confidence: "A",
    evidence:
      "Systems Thinking encompasses Emergence - emergent properties are a fundamental aspect of complex systems behavior.",
  },
  {
    source_code: "P2",
    target_code: "P4",
    relationship_type: "enables",
    confidence: "B",
    evidence:
      "Inversion enables Opportunity Cost thinking - considering what you give up helps identify true costs and benefits.",
  },
  {
    source_code: "DE2",
    target_code: "DE4",
    relationship_type: "complements",
    confidence: "A",
    evidence:
      "Scientific Method and Falsification work together - the scientific method provides the framework for systematic falsification testing.",
  },
  {
    source_code: "IN2",
    target_code: "IN5",
    relationship_type: "sequences",
    confidence: "B",
    evidence:
      "IN4 (base120-ok) typically precedes applying IN5 (base120-ok) - first assume good intent, then apply simplest explanation.",
  },
  {
    source_code: "CO3",
    target_code: "CO4",
    relationship_type: "reinforces",
    confidence: "A",
    evidence:
      "Feedback Loops and Compounding work together - compounding effects often result from positive feedback loops over time.",
  },
];

export function getSeedRelationships(): RelationshipInput[] {
  return SEED_RELATIONSHIPS;
}
