-- Add customer_name column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
