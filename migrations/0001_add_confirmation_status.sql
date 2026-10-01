-- Migration 0001: confirmation email tracking
--
-- Run this against your EXISTING database with ALTER TABLE — do NOT re-run
-- schema.sql on a live database, since schema.sql starts with
-- `DROP TABLE IF EXISTS members` and would delete all existing registrations.
--
--   npx wrangler d1 execute scja_reg_db --remote --file=./migrations/0001_add_confirmation_status.sql
--   npx wrangler d1 execute scja_reg_db --local  --file=./migrations/0001_add_confirmation_status.sql

ALTER TABLE members ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE members ADD COLUMN confirmed_at TEXT;
