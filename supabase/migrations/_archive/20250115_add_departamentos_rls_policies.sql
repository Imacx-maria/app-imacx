-- Add RLS policies for departamentos table to allow authenticated users to manage departments

-- Enable RLS on departamentos table (if not already enabled)
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Allow authenticated users to create departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Allow authenticated users to update departamentos" ON public.departamentos;

-- Allow all authenticated users to read departamentos
CREATE POLICY "Allow authenticated users to read departamentos"
ON public.departamentos
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create new departamentos
CREATE POLICY "Allow authenticated users to create departamentos"
ON public.departamentos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update departamentos
CREATE POLICY "Allow authenticated users to update departamentos"
ON public.departamentos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add comment explaining the policies
COMMENT ON TABLE public.departamentos IS 'Departamentos table with RLS policies allowing authenticated users to read, create, and update departments. Deletion is not allowed via policies for data integrity.';
