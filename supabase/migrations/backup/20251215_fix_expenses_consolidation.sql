-- Consolidate Expenses Schema
-- We need to support both legacy categories and the new payment_method.

-- 1. Add payment_method column if it doesn't exist
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- 2. Drop the old category constraint to allow all values (legacy + new)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 3. Add a new comprehensive constraint (Optional, or just allow text)
-- Merging categories: 
-- Old: services, rent, salaries, inventory, other
-- New: provider, service, withdrawal, other
-- Union: services, rent, salaries, inventory, provider, withdrawal, other
ALTER TABLE expenses 
ADD CONSTRAINT expenses_category_check 
CHECK (category IN ('services', 'rent', 'salaries', 'inventory', 'provider', 'withdrawal', 'other'));
