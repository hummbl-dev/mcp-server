// HUMMBL Relationship Validation Types
// Defines the data model for model relationships with evidence and validation workflow

export interface ModelRelationship {
  id: string;                    // R001, R002, etc.
  model_a: string;               // Model code (e.g., "DE1")
  model_b: string;               // Model code (e.g., "DE7")
  relationship_type: RelationshipType;
  direction: Direction;
  confidence: Confidence;

  // Evidence
  logical_derivation: string;    // Required: 1-3 sentence explanation
  literature_support?: {
    has_support: boolean;
    citation?: string;
    url?: string;
  };
  empirical_observation?: string;

  // Metadata
  validated_by: string;
  validated_at: string;          // ISO date
  review_status: ReviewStatus;
  notes?: string;

  // Future: Crowdsource
  community_votes?: {
    agree: number;
    disagree: number;
    unsure: number;
  };

  // Database fields
  created_at?: string;
  updated_at?: string;
}

export type RelationshipType =
  | 'enables'      // A is prerequisite for B
  | 'reinforces'   // A strengthens B (often bidirectional)
  | 'conflicts'    // A contradicts B in same context
  | 'contains'     // A is subset of B
  | 'sequences'    // A typically precedes B
  | 'complements'; // A and B address different facets

export type Direction = 'a→b' | 'b→a' | 'bidirectional';

export type Confidence = 'A' | 'B' | 'C' | 'U';
// A = High (3/3 evidence criteria)
// B = Moderate (2/3 criteria)
// C = Hypothesis (1/3 + plausibility)
// U = Unvalidated

export type ReviewStatus = 'draft' | 'reviewed' | 'confirmed' | 'disputed';

// API request/response types
export interface CreateRelationshipRequest {
  model_a: string;
  model_b: string;
  relationship_type: RelationshipType;
  direction: Direction;
  confidence?: Confidence;
  logical_derivation: string;
  literature_support?: {
    has_support: boolean;
    citation?: string;
    url?: string;
  };
  empirical_observation?: string;
  notes?: string;
  validated_by?: string;
}

export interface UpdateRelationshipRequest {
  relationship_type?: RelationshipType;
  direction?: Direction;
  confidence?: Confidence;
  logical_derivation?: string;
  literature_support?: {
    has_support: boolean;
    citation?: string;
    url?: string;
  };
  empirical_observation?: string;
  review_status?: ReviewStatus;
  notes?: string;
}

export interface RelationshipQuery {
  model?: string;        // Filter by model code (relationships involving this model)
  type?: RelationshipType;
  confidence?: Confidence;
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}

export interface RelationshipListResponse {
  relationships: ModelRelationship[];
  total: number;
  limit: number;
  offset: number;
}

export interface ModelRelationshipsResponse {
  model: string;
  relationships: Array<{
    related_model: string;
    type: RelationshipType;
    direction: 'incoming' | 'outgoing' | 'bidirectional';
    confidence: Confidence;
    logical_derivation: string;
    relationship_id: string;
  }>;
}

// Graph export types
export interface GraphNode {
  id: string;           // Model code
  name: string;         // Model name
  transformation: string; // DE, P, IN, etc.
  definition?: string;  // Optional for visualization
}

export interface GraphEdge {
  source: string;       // Model code A
  target: string;       // Model code B
  type: RelationshipType;
  direction: Direction;
  confidence: Confidence;
  logical_derivation?: string;
}

export interface GraphExport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    total_nodes: number;
    total_edges: number;
    confidence_filter: Confidence;
    status_filter: ReviewStatus;
    generated_at: string;
  };
}

// Cytoscape format for visualization
export interface CytoscapeElement {
  data: {
    id?: string;
    source?: string;
    target?: string;
    label?: string;
    type?: string;
    confidence?: string;
    [key: string]: unknown;
  };
}

export interface CytoscapeGraph {
  elements: CytoscapeElement[];
}

// Type guards
export function isRelationshipType(value: string): value is RelationshipType {
  return ['enables', 'reinforces', 'conflicts', 'contains', 'sequences', 'complements'].includes(value);
}

export function isDirection(value: string): value is Direction {
  return ['a→b', 'b→a', 'bidirectional'].includes(value);
}

export function isConfidence(value: string): value is Confidence {
  return ['A', 'B', 'C', 'U'].includes(value);
}

export function isReviewStatus(value: string): value is ReviewStatus {
  return ['draft', 'reviewed', 'confirmed', 'disputed'].includes(value);
}

// Simple relationship types (for basic implementation)
export interface SimpleRelationship {
  id?: number;
  source_code: string;
  target_code: string;
  relationship_type: string;
  confidence: 'A' | 'B' | 'C';
  evidence?: string;
  created_at?: string;
}

export interface RelationshipInput {
  source_code: string;
  target_code: string;
  relationship_type: string;
  confidence: 'A' | 'B' | 'C';
  evidence?: string;
}

export type SimpleRelationshipResult<T = SimpleRelationship> = { ok: true; value: T } | { ok: false; error: string };
