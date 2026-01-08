-- First, drop the existing products table (it's new and empty)
DROP TABLE IF EXISTS public.products;

-- Create products table (without component fields)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_id VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_components table (one-to-many relationship)
CREATE TABLE public.product_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_name VARCHAR(255) DEFAULT NULL,
  component_code VARCHAR(255) DEFAULT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage products"
ON public.products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
USING (true);

-- Enable RLS on product_components
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product_components"
ON public.product_components
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view product_components"
ON public.product_components
FOR SELECT
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_components_updated_at
BEFORE UPDATE ON public.product_components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();