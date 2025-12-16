-- Add address column to kiosks table
ALTER TABLE public.kiosks ADD COLUMN IF NOT EXISTS address TEXT;
