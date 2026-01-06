CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  metadata TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mental_models (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transformation TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT NOT NULL,
  when_to_use TEXT NOT NULL,
  how_to_apply TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- Relationships table for model interconnections
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  model_a TEXT NOT NULL,
  model_b TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'U',
  logical_derivation TEXT NOT NULL,
  has_literature_support INTEGER DEFAULT 0,
  literature_citation TEXT,
  literature_url TEXT,
  empirical_observation TEXT,
  validated_by TEXT NOT NULL,
  validated_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (model_a) REFERENCES mental_models(code),
  FOREIGN KEY (model_b) REFERENCES mental_models(code),
  CHECK (relationship_type IN ('enables', 'reinforces', 'conflicts', 'contains', 'sequences', 'complements')),
  CHECK (direction IN ('a→b', 'b→a', 'bidirectional')),
  CHECK (confidence IN ('A', 'B', 'C', 'U')),
  CHECK (review_status IN ('draft', 'reviewed', 'confirmed', 'disputed'))
);

-- Community votes table (future use)
CREATE TABLE IF NOT EXISTS relationship_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  relationship_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  voter_id TEXT,
  voted_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
  CHECK (vote IN ('agree', 'disagree', 'unsure'))
);

-- Relationship indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_relationships_model_a ON relationships(model_a);
CREATE INDEX IF NOT EXISTS idx_relationships_model_b ON relationships(model_b);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_relationships_confidence ON relationships(confidence);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(review_status);
CREATE INDEX IF NOT EXISTS idx_relationships_validated_by ON relationships(validated_by);

-- Model relationships table (simplified version)
CREATE TABLE IF NOT EXISTS model_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_code TEXT NOT NULL,
  target_code TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK(confidence IN ('A', 'B', 'C')),
  evidence TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_code) REFERENCES mental_models(code),
  FOREIGN KEY (target_code) REFERENCES mental_models(code),
  UNIQUE(source_code, target_code, relationship_type)
);
