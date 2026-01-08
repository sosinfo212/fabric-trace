-- Create chaines table
CREATE TABLE public.chaines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  num_chaine integer NOT NULL UNIQUE,
  responsable_qlty_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  chef_de_chaine_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nbr_operateur integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chaines ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage chaines"
ON public.chaines FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view chaines"
ON public.chaines FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_chaines_updated_at
BEFORE UPDATE ON public.chaines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for foreign keys
CREATE INDEX idx_chaines_responsable_qlty ON public.chaines(responsable_qlty_id);
CREATE INDEX idx_chaines_chef_de_chaine ON public.chaines(chef_de_chaine_id);