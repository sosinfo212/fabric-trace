-- Allow authenticated users to view all user_roles for dropdown filtering
CREATE POLICY "Authenticated users can view all roles for filtering"
ON public.user_roles
FOR SELECT
USING (true);