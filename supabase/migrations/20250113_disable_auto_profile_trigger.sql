-- Disable the automatic profile creation trigger that causes race conditions
-- The API will handle profile creation manually to avoid conflicts

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Clean up orphaned profiles (profiles without corresponding auth.users)
DELETE FROM public.profiles
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT id FROM auth.users);

-- Add comment explaining the change
COMMENT ON TABLE public.profiles IS 'User profiles table. Profile creation is handled by the API, not by database triggers, to avoid race conditions during user creation.';
