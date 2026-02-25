-- Agrega el flag de producto pesable para permitir vender por kilo o gramo con decimales
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_weighable BOOLEAN DEFAULT false;
