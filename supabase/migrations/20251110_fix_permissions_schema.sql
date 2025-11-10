-- Fix the permissions schema by ensuring the new roles system works correctly
-- This migration resolves the conflict between old and new role systems

-- First, ensure the roles table exists and has the correct structure
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  page_permissions JSONB DEFAULT '[]'::jsonb,
  action_permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON roles;
CREATE POLICY "Roles viewable by authenticated"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage roles" ON roles;
CREATE POLICY "Service role can manage roles"
  ON roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON roles TO authenticated;
GRANT ALL ON roles TO service_role;

-- Insert the correct role data with proper page permissions
-- Clear existing roles to avoid conflicts
DELETE FROM roles;

-- Insert roles that match the permission types in types/permissions.ts
-- Based on the application structure, here are the logical access patterns
INSERT INTO roles (name, description, page_permissions) VALUES
  ('admin', 'Administrator with full access', '["*"]'::jsonb),
  ('designer', 'Designer with access to design flow and dashboard', '["dashboard", "designer-flow"]'::jsonb),
  ('op_stocks', 'Stocks operator with access to stocks management and dashboard', '["dashboard", "stocks", "stocks/gestao", "producao", "producao/operacoes"]'::jsonb),
  ('op_producao', 'Production operator with access to production and dashboard', '["dashboard", "producao", "producao/operacoes", "stocks", "stocks/gestao"]'::jsonb);

-- Ensure profiles table has the correct structure
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  telemovel TEXT,
  notas TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON profiles;
CREATE POLICY "Authenticated can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_roles_page_permissions ON roles USING gin(page_permissions);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- Migrate existing user profiles to use the new role system
-- First, check if we can map old roles to new ones
UPDATE profiles 
SET role_id = (
  SELECT r.id FROM roles r 
  WHERE r.name = 'admin'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM user_profiles up 
  WHERE up.auth_user_id = profiles.user_id 
  AND up.role_id IN (
    SELECT id FROM user_roles WHERE LOWER(nome) LIKE '%admin%'
  )
);

UPDATE profiles 
SET role_id = (
  SELECT r.id FROM roles r 
  WHERE r.name = 'designer'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM user_profiles up 
  WHERE up.auth_user_id = profiles.user_id 
  AND up.role_id IN (
    SELECT id FROM user_roles WHERE LOWER(nome) LIKE '%designer%'
  )
);

UPDATE profiles 
SET role_id = (
  SELECT r.id FROM roles r 
  WHERE r.name = 'op_stocks'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM user_profiles up 
  WHERE up.auth_user_id = profiles.user_id 
  AND up.role_id IN (
    SELECT id FROM user_roles WHERE LOWER(nome) LIKE '%gestor%' OR LOWER(nome) LIKE '%manager%'
  )
);

-- For any users without a mapped role, give them dashboard access only
UPDATE profiles 
SET role_id = (
  SELECT r.id FROM roles r 
  WHERE r.name = 'designer'  -- Default to designer permissions (dashboard + designer-flow)
  LIMIT 1
)
WHERE role_id IS NULL;

-- Create or update index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Add a comment to explain the system
COMMENT ON TABLE roles IS 'New role system for page-based permissions. Each role has an array of page paths in page_permissions.';
COMMENT ON COLUMN roles.page_permissions IS 'Array of page paths that this role can access. Use ["*"] for all pages, or specific paths like ["dashboard", "stocks"]';