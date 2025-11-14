-- Add unique constraint on user_id in profiles table
-- This is required for upsert operations and ensures one profile per user

-- First, remove any duplicate entries if they exist
DELETE FROM public.profiles a
USING public.profiles b
WHERE a.id > b.id
AND a.user_id = b.user_id;

-- Add the unique constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT profiles_user_id_key ON public.profiles IS 'Ensures each auth user has exactly one profile';


