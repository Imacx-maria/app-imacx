-- Fix user_siglas table to allow spaces in sigla column (e.g., "CG 10", "CG 25")
-- The current CHECK constraint is blocking siglas with spaces

-- Drop the existing constraint that blocks spaces
ALTER TABLE public.user_siglas
DROP CONSTRAINT IF EXISTS user_siglas_sigla_check;

-- Add a new constraint that allows spaces but prevents empty strings
ALTER TABLE public.user_siglas
ADD CONSTRAINT user_siglas_sigla_check
CHECK (sigla IS NOT NULL AND LENGTH(TRIM(sigla)) > 0);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT user_siglas_sigla_check ON public.user_siglas IS
'Ensures sigla is not null and not empty after trimming. Allows spaces within the sigla (e.g., "CG 10", "CG 25").';
