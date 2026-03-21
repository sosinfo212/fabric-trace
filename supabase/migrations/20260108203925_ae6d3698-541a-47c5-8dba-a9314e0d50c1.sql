-- First drop the RLS policies that depend on has_role function
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Drop the default value on user_roles table
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;

-- Now drop the functions
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role app_role);
DROP FUNCTION IF EXISTS public.get_user_role(_user_id uuid);

-- Create a temporary column to hold the role values
ALTER TABLE public.user_roles ADD COLUMN role_temp text;
UPDATE public.user_roles SET role_temp = role::text;

-- Drop the old role column
ALTER TABLE public.user_roles DROP COLUMN role;

-- Drop the old enum
DROP TYPE IF EXISTS public.app_role;

-- Create new enum with all roles
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'planificatrice',
  'responsable_magasin_pf',
  'controle',
  'chef_de_chaine',
  'agent_qualite',
  'chef_equipe_serigraphie',
  'responsable_magasin',
  'chef_equipe_injection',
  'chef_equipe_pf',
  'agent_logistique',
  'agent_magasin',
  'responsable_transport',
  'operator'
);

-- Add the role column back with the new type
ALTER TABLE public.user_roles ADD COLUMN role public.app_role NOT NULL DEFAULT 'operator';

-- Migrate data back (convert old roles to new)
UPDATE public.user_roles 
SET role = CASE 
  WHEN role_temp = 'admin' THEN 'admin'::app_role
  WHEN role_temp = 'supervisor' THEN 'controle'::app_role
  WHEN role_temp = 'operator' THEN 'operator'::app_role
  ELSE 'operator'::app_role
END
WHERE role_temp IS NOT NULL;

-- Drop temporary column
ALTER TABLE public.user_roles DROP COLUMN role_temp;

-- Recreate the has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate the get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Recreate the RLS policies
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));