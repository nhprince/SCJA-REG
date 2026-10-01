-- Sohrawardi College Journalist Association (SCJA) — Member Registration
-- D1 (SQLite) schema
--
-- NOTE: this file is for a FRESH database only — it drops the table first.
-- If you already have a live database with real registrations, do not
-- re-run this file. Use the incremental files in /migrations instead.

DROP TABLE IF EXISTS members;

CREATE TABLE members (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Personal
  full_name             TEXT NOT NULL,
  date_of_birth         TEXT,
  blood_group           TEXT,
  profile_photo         TEXT,              -- base64 data URI, resized client-side

  -- Academic
  student_id            TEXT NOT NULL,
  department            TEXT NOT NULL,
  year                  TEXT NOT NULL,
  session               TEXT NOT NULL,

  -- Contact & Guardian
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  present_address       TEXT,
  permanent_address     TEXT,
  guardian_name         TEXT,
  guardian_phone        TEXT,

  -- Additional
  reason_to_join        TEXT,
  previous_experience   TEXT,
  interests             TEXT,              -- JSON-stringified array
  social_link           TEXT,
  id_document_photo     TEXT,              -- base64 data URI: college ID card or birth certificate

  -- Confirmation email
  confirmation_status   TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed'
  confirmed_at          TEXT,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_members_department ON members(department);
CREATE INDEX idx_members_created_at ON members(created_at);
CREATE INDEX idx_members_student_id ON members(student_id);
