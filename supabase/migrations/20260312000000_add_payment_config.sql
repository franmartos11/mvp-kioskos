-- Add payment_config JSONB column to kiosks table
-- Stores transfer payment info: alias, CVU, holder name, bank, MP link
alter table public.kiosks
  add column if not exists payment_config jsonb default '{}'::jsonb;

-- Example shape:
-- {
--   "alias": "kiosco.abc",
--   "cvu": "0000003100010012345678",
--   "holder_name": "Juan García",
--   "bank_name": "Banco Galicia",
--   "mp_link": "https://link.mercadopago.com.ar/...",
--   "qr_source": "alias"   -- "alias" | "mp_link" | "cvu"
-- }
