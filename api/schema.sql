-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'server',
  vendor TEXT,
  product TEXT,
  version TEXT,
  port INTEGER,
  network TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Threats table
CREATE TABLE IF NOT EXISTS threats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  cvss_score REAL,
  affected_vendor TEXT,
  affected_product TEXT,
  affected_version TEXT,
  exploits_available INTEGER NOT NULL DEFAULT 0,
  actively_exploited INTEGER NOT NULL DEFAULT 0,
  published_date TEXT,
  raw_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Briefings table
CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threat_id INTEGER NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  summary TEXT,
  remediation TEXT,
  business_impact TEXT,
  priority_score REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source);
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_source_id ON threats(source_id);
CREATE INDEX IF NOT EXISTS idx_briefings_threat ON briefings(threat_id);
CREATE INDEX IF NOT EXISTS idx_briefings_asset ON briefings(asset_id);
CREATE INDEX IF NOT EXISTS idx_briefings_status ON briefings(status);
