-- Drop foreign key constraints from fab_orders
ALTER TABLE public.fab_orders DROP CONSTRAINT IF EXISTS fab_orders_product_id_fkey;
ALTER TABLE public.fab_orders DROP CONSTRAINT IF EXISTS fab_orders_client_id_fkey;

-- Change client_id and product_id to text type to store names/refs instead of UUIDs
ALTER TABLE public.fab_orders 
  ALTER COLUMN client_id TYPE text USING client_id::text,
  ALTER COLUMN product_id TYPE text USING product_id::text;