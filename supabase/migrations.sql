-- Migrations applied via Supabase Management API
ALTER TABLE trips ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked BOOLEAN NOT NULL DEFAULT false;

-- 2026-06-01: Gmail booking scanner schema
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_transportation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_stay BOOLEAN NOT NULL DEFAULT false;
