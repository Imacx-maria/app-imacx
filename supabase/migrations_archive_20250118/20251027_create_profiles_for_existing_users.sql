-- Create profiles for all existing authenticated users that don't have one yet

INSERT INTO public.profiles (
  user_id,
  email,
  first_name,
  last_name,
  active,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  true,
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
);

-- Also assign admin role to users if needed (optional - adjust as needed)
-- Uncomment if you want to assign the admin role to users with 'admin' in their email
-- UPDATE public.profiles 
-- SET role_id = (SELECT id FROM public.roles WHERE LOWER(name) = 'admin' LIMIT 1)
-- WHERE email LIKE '%admin%' AND role_id IS NULL;
