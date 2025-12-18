-- Add AFIP Invoicing fields to Sales table
alter table public.sales
add column if not exists invoice_number text, -- e.g. "00001-00000045"
add column if not exists invoice_type text,   -- "A", "B", "C"
add column if not exists doc_type text,       -- "DNI", "CUIT"
add column if not exists doc_number text,     -- Customer Doc Number
add column if not exists cae text,            -- AFIP Authorization Code
add column if not exists cae_expiration timestamp with time zone;

-- Index for faster filtering of uninvoiced sales
create index if not exists idx_sales_uninvoiced on public.sales(kiosk_id, created_at) where invoice_number is null;
