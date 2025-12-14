-- ==============================================================================
-- FIX: Storage Policies for Product Images
-- ==============================================================================

-- 1. Create 'products' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

-- 2. Allow public access to view files in 'products' bucket
drop policy if exists "Public Access to Products" on storage.objects;
create policy "Public Access to Products"
on storage.objects for select
using ( bucket_id = 'products' );

-- 3. Allow authenticated users to upload files to 'products' bucket
drop policy if exists "Authenticated users can upload products" on storage.objects;
create policy "Authenticated users can upload products"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'products' );

-- 4. Allow authenticated users to update/delete their uploads
drop policy if exists "Authenticated users can update products" on storage.objects;
create policy "Authenticated users can update products"
on storage.objects for update
to authenticated
using ( bucket_id = 'products' );

drop policy if exists "Authenticated users can delete products" on storage.objects;
create policy "Authenticated users can delete products"
on storage.objects for delete
to authenticated
using ( bucket_id = 'products' );
