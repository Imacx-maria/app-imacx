-- Fix missing emails in profiles table
-- This script copies emails from auth.users to profiles where email is missing

-- Update profiles with missing emails by copying from auth.users
UPDATE public.profiles p
SET 
  email = au.email,
  updated_at = CURRENT_DATE
FROM auth.users au
WHERE 
  p.user_id = au.id 
  AND (p.email IS NULL OR p.email = '');

-- Report the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.profiles p
  INNER JOIN auth.users au ON p.user_id = au.id
  WHERE p.email IS NOT NULL AND p.email != '';
  
  RAISE NOTICE 'Fixed profiles with missing emails. Total profiles with emails now: %', updated_count;
END $$;

-- Optional: Show any remaining profiles without emails (these would be orphaned)
SELECT 
  p.id as profile_id,
  p.user_id,
  p.first_name,
  p.last_name,
  p.email as profile_email,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NULL THEN 'Auth user missing'
    WHEN p.email IS NULL OR p.email = '' THEN 'Email missing in profile'
    ELSE 'OK'
  END as status
FROM public.profiles p
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE p.email IS NULL OR p.email = '' OR au.id IS NULL
ORDER BY p.created_at DESC;
