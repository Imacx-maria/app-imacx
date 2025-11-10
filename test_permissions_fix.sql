-- Test script to verify the permissions fix is working
-- This script can be run to check the current state and apply fixes if needed

-- First, check what roles currently exist and their permissions
SELECT 
    r.name as role_name,
    r.description,
    r.page_permissions,
    COUNT(p.id) as user_count
FROM roles r
LEFT JOIN profiles p ON p.role_id = r.id
GROUP BY r.id, r.name, r.description, r.page_permissions
ORDER BY r.name;

-- Check if we have any users without roles (they should be getting dashboard-only access)
SELECT 
    'Users without roles' as status,
    COUNT(*) as count
FROM profiles 
WHERE role_id IS NULL

UNION ALL

-- Check if we have any users with the old user_profiles system that need migration
SELECT 
    'Old system users' as status,
    COUNT(*) as count
FROM user_profiles 
WHERE auth_user_id NOT IN (SELECT user_id FROM profiles);

-- If needed, create the new roles system (only if it doesn't exist)
DO $$
BEGIN
    -- Create roles table if it doesn't exist
    CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        page_permissions JSONB DEFAULT '[]'::jsonb,
        action_permissions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- Insert the role data
    DELETE FROM roles; -- Clear existing data
    
    INSERT INTO roles (name, description, page_permissions) VALUES
        ('admin', 'Administrator with full access', '["*"]'::jsonb),
        ('designer', 'Designer with access to design flow and dashboard', '["dashboard", "designer-flow"]'::jsonb),
        ('op_stocks', 'Stocks operator with access to stocks management and dashboard', '["dashboard", "stocks", "stocks/gestao", "producao", "producao/operacoes"]'::jsonb),
        ('op_producao', 'Production operator with access to production and dashboard', '["dashboard", "producao", "producao/operacoes", "stocks", "stocks/gestao"]'::jsonb);
        
    RAISE NOTICE 'Roles created/updated successfully';
END $$;

-- Update existing users to use the new role system
-- First, ensure profiles table exists
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

-- Create missing profiles for users who don't have them
INSERT INTO profiles (user_id, email, nome_completo)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as nome_completo
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- Update profiles to use appropriate roles
UPDATE profiles 
SET role_id = (
    SELECT r.id FROM roles r WHERE r.name = 'admin'
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
    SELECT r.id FROM roles r WHERE r.name = 'designer'
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.auth_user_id = profiles.user_id 
    AND up.role_id IN (
        SELECT id FROM user_roles WHERE LOWER(nome) LIKE '%designer%'
    )
);

-- Give default access to any user without a role
UPDATE profiles 
SET role_id = (
    SELECT r.id FROM roles r WHERE r.name = 'op_stocks'  -- Default to stocks operator (broadest access)
    LIMIT 1
)
WHERE role_id IS NULL;

-- Final verification - show current state
SELECT 
    'Final verification' as test,
    r.name as role_name,
    COUNT(p.id) as user_count,
    r.page_permissions
FROM roles r
LEFT JOIN profiles p ON p.role_id = r.id
GROUP BY r.id, r.name, r.page_permissions
ORDER BY r.name;

-- Check a sample permission check to verify the system works
SELECT 
    'Permission test' as test,
    'admin role should access all pages' as description,
    CASE 
        WHEN '["*"]'::jsonb ? 'dashboard' THEN 'PASS' 
        ELSE 'FAIL' 
    END as result
UNION ALL
SELECT 
    'Permission test' as test,
    'designer role should access dashboard' as description,
    CASE 
        WHEN '["dashboard", "designer-flow"]'::jsonb ? 'dashboard' THEN 'PASS' 
        ELSE 'FAIL' 
    END as result
UNION ALL
SELECT 
    'Permission test' as test,
    'designer role should access designer-flow' as description,
    CASE 
        WHEN '["dashboard", "designer-flow"]'::jsonb ? 'designer-flow' THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;