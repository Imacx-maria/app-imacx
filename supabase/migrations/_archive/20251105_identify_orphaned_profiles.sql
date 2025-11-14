-- Identify profiles without corresponding auth users
-- These profiles cannot login and need auth users created

-- Query to find orphaned profiles (profiles without auth users)
-- Run this in Supabase SQL editor to see which profiles need fixing

SELECT 
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  r.name as role_name,
  p.created_at,
  'ORPHANED - No auth user' as status
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE p.user_id NOT IN (
  SELECT id FROM auth.users
)
ORDER BY p.created_at DESC;

-- To fix these users, you have two options:

-- OPTION 1: Delete orphaned profiles (if they shouldn't exist)
-- DELETE FROM public.profiles 
-- WHERE user_id NOT IN (SELECT id FROM auth.users);

-- OPTION 2: Create auth users for these profiles (recommended)
-- You'll need to do this through the application's repair function
-- or manually create auth users in Supabase dashboard with matching user_ids
