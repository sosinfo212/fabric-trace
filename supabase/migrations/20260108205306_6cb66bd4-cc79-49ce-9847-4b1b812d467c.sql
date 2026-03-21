-- Create table for role permissions (menu access)
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  menu_path text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role, menu_path)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can manage permissions
CREATE POLICY "Admins can view all permissions"
ON public.role_permissions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert permissions"
ON public.role_permissions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update permissions"
ON public.role_permissions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete permissions"
ON public.role_permissions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read permissions (needed for sidebar)
CREATE POLICY "Authenticated users can view permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for custom roles (for future extensibility)
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Policies for custom_roles
CREATE POLICY "Admins can manage custom roles"
ON public.custom_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view custom roles"
ON public.custom_roles FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default system roles
INSERT INTO public.custom_roles (name, label, description, is_system) VALUES
('admin', 'Administrateur', 'Accès complet à toutes les fonctionnalités du système', true),
('planificatrice', 'Planificatrice', 'Gestion du planning, commandes et déclarations', true),
('responsable_magasin_pf', 'Responsable Magasin PF', 'Gestion des produits finis et expédition', true),
('controle', 'Contrôle', 'Suivi de production et contrôle qualité', true),
('chef_de_chaine', 'Chef de Chaîne', 'Gestion de la chaîne de production', true),
('agent_qualite', 'Agent Qualité', 'Déclaration des défauts et contrôle qualité', true),
('chef_equipe_serigraphie', 'Chef d''équipe Sérigraphie', 'Gestion de l''équipe sérigraphie', true),
('responsable_magasin', 'Responsable Magasin', 'Gestion du magasin et stocks', true),
('chef_equipe_injection', 'Chef d''équipe Injection', 'Gestion de l''équipe injection', true),
('chef_equipe_pf', 'Chef d''équipe PF', 'Gestion de l''équipe produits finis', true),
('agent_logistique', 'Agent Logistique', 'Gestion des transferts et mouvements', true),
('agent_magasin', 'Agent Magasin', 'Opérations magasin et transferts', true),
('responsable_transport', 'Responsable Transport', 'Gestion du transport et expédition', true),
('operator', 'Opérateur', 'Accès limité aux fonctionnalités de base', true);