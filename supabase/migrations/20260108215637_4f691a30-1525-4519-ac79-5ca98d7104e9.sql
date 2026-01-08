
-- Create commandes table
CREATE TABLE public.commandes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  num_commande VARCHAR(100) NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  date_planifiee DATE,
  date_debut DATE,
  date_fin DATE,
  instruction TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage commandes"
ON public.commandes
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Planificatrice can manage commandes"
ON public.commandes
FOR ALL
USING (has_role(auth.uid(), 'planificatrice'));

CREATE POLICY "Authenticated users can view commandes"
ON public.commandes
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_commandes_updated_at
  BEFORE UPDATE ON public.commandes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
