-- Migration to add DELETE policies for production tables
-- This allows authenticated users to delete records from folhas_obras and related tables

-- Add DELETE policy for folhas_obras
DROP POLICY IF EXISTS "Allow authenticated users to delete folhas_obras" ON public.folhas_obras;
CREATE POLICY "Allow authenticated users to delete folhas_obras"
  ON public.folhas_obras
  FOR DELETE
  TO authenticated
  USING (true);

-- Add DELETE policy for items_base (needed for direct deletes, though CASCADE should handle it)
DROP POLICY IF EXISTS "Allow authenticated users to delete items_base" ON public.items_base;
CREATE POLICY "Allow authenticated users to delete items_base"
  ON public.items_base
  FOR DELETE
  TO authenticated
  USING (true);

-- Add DELETE policy for designer_items
DROP POLICY IF EXISTS "Allow authenticated users to delete designer_items" ON public.designer_items;
CREATE POLICY "Allow authenticated users to delete designer_items"
  ON public.designer_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Add DELETE policy for logistica_entregas
DROP POLICY IF EXISTS "Allow authenticated users to delete logistica_entregas" ON public.logistica_entregas;
CREATE POLICY "Allow authenticated users to delete logistica_entregas"
  ON public.logistica_entregas
  FOR DELETE
  TO authenticated
  USING (true);

-- Add DELETE policy for producao_operacoes
DROP POLICY IF EXISTS "Allow authenticated users to delete producao_operacoes" ON public.producao_operacoes;
CREATE POLICY "Allow authenticated users to delete producao_operacoes"
  ON public.producao_operacoes
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON POLICY "Allow authenticated users to delete folhas_obras" ON public.folhas_obras IS
  'Allows authenticated users to delete folhas_obras. CASCADE will automatically delete related records.';
