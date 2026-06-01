-- Run this in the Supabase SQL editor to add custom colour support for stays
ALTER TABLE trips ADD COLUMN IF NOT EXISTS color TEXT;
