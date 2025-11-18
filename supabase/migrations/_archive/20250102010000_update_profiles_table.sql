-- Extend profiles table with contact fields for user management
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

UPDATE profiles
SET active = true
WHERE active IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
ON profiles (LOWER(email))
WHERE email IS NOT NULL;
