-- jev street submissions. Apply with: wrangler d1 execute jebst --remote --file schema.sql  (or --local for wrangler pages dev)
CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  game TEXT NOT NULL,
  model TEXT NOT NULL,
  device TEXT,
  driver TEXT NOT NULL,
  seed INTEGER,
  turns INTEGER NOT NULL,
  score REAL NOT NULL,
  score_label TEXT,
  status TEXT,
  options TEXT,
  overrides INTEGER DEFAULT 0,
  median_ms REAL,
  max_turns INTEGER,
  run_id TEXT,
  note TEXT,
  frame_count INTEGER NOT NULL,
  frames TEXT NOT NULL,
  created_at TEXT,
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rides_game_model ON rides (game, model, submitted_at);
CREATE INDEX IF NOT EXISTS rides_run ON rides (run_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  model TEXT NOT NULL,
  device TEXT,
  driver TEXT NOT NULL,
  car TEXT,
  rows TEXT NOT NULL,
  ride_ids TEXT NOT NULL,
  note TEXT,
  created_at TEXT,
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_model ON runs (model, submitted_at);
