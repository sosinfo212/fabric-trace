
-- Create fab_orders table
CREATE TABLE IF NOT EXISTS public.fab_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  of_id VARCHAR(255) UNIQUE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  prod_ref VARCHAR(255),
  prod_name VARCHAR(255),
  chaine_id UUID NOT NULL REFERENCES public.chaines(id) ON DELETE CASCADE,
  sale_order_id VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  creation_date_of TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date_fabrication TIMESTAMP WITH TIME ZONE,
  pf_qty INTEGER NOT NULL DEFAULT 0,
  sf_qty INTEGER NOT NULL DEFAULT 0,
  set_qty INTEGER NOT NULL DEFAULT 0,
  tester_qty INTEGER NOT NULL DEFAULT 0,
  lot_set VARCHAR(255) NOT NULL DEFAULT '',
  instruction TEXT,
  comment_chaine TEXT,
  end_prod TIMESTAMP WITH TIME ZONE,
  statut_of VARCHAR(40) NOT NULL DEFAULT 'Planifié',
  comment TEXT,
  order_prod VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint for valid statuses
ALTER TABLE public.fab_orders DROP CONSTRAINT IF EXISTS fab_orders_statut_check;
ALTER TABLE public.fab_orders ADD CONSTRAINT fab_orders_statut_check 
  CHECK (statut_of IN ('Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu'));

-- Enable RLS
ALTER TABLE public.fab_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage fab_orders" ON public.fab_orders;
DROP POLICY IF EXISTS "Chef de chaine can view their fab_orders" ON public.fab_orders;
DROP POLICY IF EXISTS "Chef de chaine can insert fab_orders for their chaine" ON public.fab_orders;
DROP POLICY IF EXISTS "Chef de chaine can update their chaine fab_orders" ON public.fab_orders;

-- RLS Policies
CREATE POLICY "Admins can manage fab_orders"
ON public.fab_orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Chef de chaine can view their fab_orders"
ON public.fab_orders FOR SELECT
USING (has_role(auth.uid(), 'chef_chaine'::app_role));

CREATE POLICY "Chef de chaine can insert fab_orders for their chaine"
ON public.fab_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'chef_chaine'::app_role));

CREATE POLICY "Chef de chaine can update their chaine fab_orders"
ON public.fab_orders FOR UPDATE
USING (has_role(auth.uid(), 'chef_chaine'::app_role));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fab_orders_statut ON public.fab_orders(statut_of);
CREATE INDEX IF NOT EXISTS idx_fab_orders_chaine ON public.fab_orders(chaine_id);
CREATE INDEX IF NOT EXISTS idx_fab_orders_client ON public.fab_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_fab_orders_of_id ON public.fab_orders(of_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_fab_orders_updated_at ON public.fab_orders;
CREATE TRIGGER update_fab_orders_updated_at
  BEFORE UPDATE ON public.fab_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
