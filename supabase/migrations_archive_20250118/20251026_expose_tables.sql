-- This migration exposes the existing tables to PostgREST (Supabase REST API)

-- Ensure profiles table has proper structure (should already exist)
-- Just add any missing columns if needed

ALTER TABLE IF EXISTS profiles 
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN active SET DEFAULT true;

-- Enable RLS on profiles table
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (may fail safely)
DROP POLICY IF EXISTS "Profiles visible to authenticated users" ON profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create RLS policy - allow authenticated users to read all profiles
CREATE POLICY "Profiles viewable by authenticated"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Ensure roles table has proper RLS
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roles visible to authenticated" ON roles;

CREATE POLICY "Roles viewable by authenticated"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage roles"
  ON roles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON roles TO authenticated;
GRANT ALL ON roles TO service_role;

-- Ensure role_permissions table exists and is configured
DROP POLICY IF EXISTS "Role permissions viewable by authenticated" ON role_permissions;

ALTER TABLE IF EXISTS role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role permissions viewable by authenticated"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage role permissions"
  ON role_permissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON role_permissions TO authenticated;
GRANT ALL ON role_permissions TO service_role;
