-- Fix RLS policies on profiles table to allow users to read their own profile

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;

-- Create new, simpler policies
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow authenticated users to read all profiles (needed for role info, etc)
CREATE POLICY "Authenticated can read all profiles"
  ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert (for creating new users via API)
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Also create policies for roles table to ensure it's readable
DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can manage user_roles" ON roles;

CREATE POLICY "Everyone can read roles"
  ON roles
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage roles"
  ON roles
  FOR ALL
  USING (auth.role() = 'service_role');
