-- Add page_permissions column to roles table
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS page_permissions JSONB DEFAULT '[]'::jsonb;

-- Add description column if it doesn't exist
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment to explain the structure
COMMENT ON COLUMN roles.page_permissions IS 'Array of page paths that this role can access. Empty array means no access, ["*"] means all pages';

-- Update existing roles with default permissions based on typical access patterns
UPDATE roles
SET page_permissions = CASE
  WHEN LOWER(name) LIKE '%admin%' THEN '["*"]'::jsonb  -- Admins see everything
  WHEN LOWER(name) LIKE '%designer%' THEN '["dashboard", "designer-flow"]'::jsonb
  WHEN LOWER(name) LIKE '%gestor%' OR LOWER(name) LIKE '%manager%' THEN '["dashboard", "gestao"]'::jsonb
  ELSE '["dashboard"]'::jsonb  -- Default: only dashboard
END
WHERE page_permissions = '[]'::jsonb OR page_permissions IS NULL;

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_roles_page_permissions ON roles USING gin(page_permissions);
