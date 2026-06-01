-- Migrations applied via Supabase Management API
ALTER TABLE trips ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked BOOLEAN NOT NULL DEFAULT false;
