-- Add DELETE policy for departamentos table
-- This allows authenticated users to delete departamentos (except the default IMACX)
-- The application code handles reassigning employees before deletion

-- Allow authenticated users to delete departamentos
CREATE POLICY "Allow authenticated users to delete departamentos"
ON public.departamentos
FOR DELETE
TO authenticated
USING (true);

-- Update table comment
COMMENT ON TABLE public.departamentos IS 'Departamentos table with RLS policies allowing authenticated users full CRUD access. Application logic prevents deletion of default department.';
