-- Migration to add CASCADE DELETE to foreign key constraints
-- This ensures that when a folha_obra is deleted, all related records are automatically deleted

-- Step 1: Drop existing foreign keys that don't have CASCADE DELETE
-- (We need to recreate them with ON DELETE CASCADE)

-- Drop items_base.folha_obra_id FK
ALTER TABLE IF EXISTS public.items_base
  DROP CONSTRAINT IF EXISTS items_base_folha_obra_id_fkey;

-- Drop designer_items.item_id FK
ALTER TABLE IF EXISTS public.designer_items
  DROP CONSTRAINT IF EXISTS designer_items_item_id_fkey;

-- Drop logistica_entregas.item_id FK
ALTER TABLE IF EXISTS public.logistica_entregas
  DROP CONSTRAINT IF EXISTS logistica_entregas_item_id_fkey;

-- Drop producao_operacoes.item_id FK (if exists)
ALTER TABLE IF EXISTS public.producao_operacoes
  DROP CONSTRAINT IF EXISTS producao_operacoes_item_id_fkey;

-- Step 2: Add foreign keys with CASCADE DELETE

-- items_base.folha_obra_id -> folhas_obras.id (CASCADE DELETE)
ALTER TABLE public.items_base
  ADD CONSTRAINT items_base_folha_obra_id_fkey
  FOREIGN KEY (folha_obra_id)
  REFERENCES public.folhas_obras(id)
  ON DELETE CASCADE;

-- designer_items.item_id -> items_base.id (CASCADE DELETE)
ALTER TABLE public.designer_items
  ADD CONSTRAINT designer_items_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES public.items_base(id)
  ON DELETE CASCADE;

-- logistica_entregas.item_id -> items_base.id (CASCADE DELETE)
ALTER TABLE public.logistica_entregas
  ADD CONSTRAINT logistica_entregas_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES public.items_base(id)
  ON DELETE CASCADE;

-- producao_operacoes.item_id -> items_base.id (CASCADE DELETE) - if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_operacoes'
      AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.producao_operacoes
      ADD CONSTRAINT producao_operacoes_item_id_fkey
      FOREIGN KEY (item_id)
      REFERENCES public.items_base(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 3: Handle designer_planos table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'designer_planos'
  ) THEN
    -- Drop existing FK
    ALTER TABLE public.designer_planos
      DROP CONSTRAINT IF EXISTS designer_planos_item_id_fkey;
    
    -- Add FK with CASCADE DELETE
    ALTER TABLE public.designer_planos
      ADD CONSTRAINT designer_planos_item_id_fkey
      FOREIGN KEY (item_id)
      REFERENCES public.items_base(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add comment to document the cascade delete behavior
COMMENT ON CONSTRAINT items_base_folha_obra_id_fkey ON public.items_base IS
  'CASCADE DELETE: When a folha_obra is deleted, all related items are automatically deleted';

COMMENT ON CONSTRAINT designer_items_item_id_fkey ON public.designer_items IS
  'CASCADE DELETE: When an item is deleted, all related designer_items are automatically deleted';

COMMENT ON CONSTRAINT logistica_entregas_item_id_fkey ON public.logistica_entregas IS
  'CASCADE DELETE: When an item is deleted, all related logistica_entregas are automatically deleted';
