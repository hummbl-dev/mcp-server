-- Migration: 002_relationships
-- Add model_relationships table for simplified relationship storage
-- This table stores validated relationships between mental models

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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_relationships_source ON model_relationships(source_code);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON model_relationships(target_code);
CREATE INDEX IF NOT EXISTS idx_relationships_confidence ON model_relationships(confidence);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON model_relationships(relationship_type);
