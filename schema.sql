DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS digests;

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  theme TEXT,
  sentiment TEXT,
  urgency TEXT,
  tags TEXT
);

CREATE TABLE digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadence TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  summary TEXT NOT NULL,
  themes_json TEXT,
  sentiment_json TEXT,
  urgent_ids_json TEXT,
  created_at TEXT NOT NULL
);
