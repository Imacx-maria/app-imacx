-- Enable RLS on cores_impressao table
ALTER TABLE public.cores_impressao ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cores
CREATE POLICY "Allow authenticated to read cores_impressao"
ON public.cores_impressao
FOR SELECT
TO authenticated
USING (true);

-- Verify the data exists
SELECT * FROM cores_impressao ORDER BY n_cores;
