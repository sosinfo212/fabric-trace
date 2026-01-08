-- Create defect categories table
CREATE TABLE public.defaut_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create defect list table
CREATE TABLE public.defaut_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.defaut_categories(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.defaut_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defaut_list ENABLE ROW LEVEL SECURITY;

-- Policies for defaut_categories
CREATE POLICY "Admins can manage defaut_categories"
ON public.defaut_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view defaut_categories"
ON public.defaut_categories FOR SELECT
TO authenticated
USING (true);

-- Policies for defaut_list
CREATE POLICY "Admins can manage defaut_list"
ON public.defaut_list FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view defaut_list"
ON public.defaut_list FOR SELECT
TO authenticated
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_defaut_categories_updated_at
BEFORE UPDATE ON public.defaut_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_defaut_list_updated_at
BEFORE UPDATE ON public.defaut_list
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_defaut_list_category_id ON public.defaut_list(category_id);