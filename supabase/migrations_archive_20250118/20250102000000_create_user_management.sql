-- Enable UUID extension (Supabase uses pgcrypto by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  permissoes JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  role_id UUID REFERENCES user_roles(id),
  telemovel TEXT,
  notas TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create default roles
INSERT INTO user_roles (nome, descricao, permissoes, ativo) VALUES
  ('Administrador', 'Acesso total ao sistema', '{"all": true}'::jsonb, true),
  ('Gestor', 'Gestor de projeto com acesso a relatórios', '{"manage_users": true, "view_reports": true}'::jsonb, true),
  ('Designer', 'Designer com acesso ao fluxo de design', '{"design_flow": true}'::jsonb, true),
  ('Utilizador', 'Utilizador padrão com acesso limitado', '{"view_basic": true}'::jsonb, true)
ON CONFLICT (nome) DO NOTHING;

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_roles - authenticated users can read
CREATE POLICY "Authenticated users can read user_roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policy for user_roles - only admin can manage (we'll add role checking later)
CREATE POLICY "Authenticated users can manage user_roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_profiles - users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Create RLS policy for user_profiles - allow reading all profiles (for admin)
CREATE POLICY "Authenticated users can read profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policy for user_profiles - users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Create RLS policy for user_profiles - allow insert and delete for authenticated (admin only in production)
CREATE POLICY "Authenticated users can manage profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
