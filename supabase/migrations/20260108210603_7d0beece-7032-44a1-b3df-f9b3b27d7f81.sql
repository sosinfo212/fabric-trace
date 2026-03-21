-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  designation text,
  instruction text,
  instruction_logistique text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policies: Admins and planificatrice can manage clients
CREATE POLICY "Admins can manage clients"
ON public.clients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planificatrice can view clients"
ON public.clients FOR SELECT
USING (has_role(auth.uid(), 'planificatrice'::app_role));

CREATE POLICY "Planificatrice can insert clients"
ON public.clients FOR INSERT
WITH CHECK (has_role(auth.uid(), 'planificatrice'::app_role));

CREATE POLICY "Planificatrice can update clients"
ON public.clients FOR UPDATE
USING (has_role(auth.uid(), 'planificatrice'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();