-- Fix Orphaned Users - Remove profiles without valid auth users
-- Execute this in Supabase SQL Editor

-- STEP 1: Check orphaned profiles (ANTES de eliminar)
SELECT
  p.id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role_id,
  p.departamento_id,
  'ORPHANED - Auth user does not exist' as status
FROM profiles p
WHERE p.user_id IN (
  'f047f780-a222-470a-baf3-498a3bb41763',  -- prod6@imacx.pt
  '02d94c4d-04eb-4065-b53e-de2dad63a6e4'   -- rui.batista@imacx.pt
);

-- STEP 2: Delete orphaned profiles
-- ATENÇÃO: Isto vai ELIMINAR permanentemente os perfis órfãos!

DELETE FROM profiles
WHERE id IN (
  '016dadeb-023d-49ca-a2be-dcfb4ff1be47',  -- prod6@imacx.pt (Jeferson Mendonça)
  'b94015c2-a719-451a-93df-6ee8d4473b70'   -- rui.batista@imacx.pt (Rui Batista)
);

-- STEP 3: Verify deletion (deve retornar 0 rows)
SELECT * FROM profiles
WHERE email IN ('prod6@imacx.pt', 'rui.batista@imacx.pt');

-- STEP 4: Now you can create these users again via the UI!
