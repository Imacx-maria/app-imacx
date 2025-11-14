-- Add new transport fields to logistica_entregas table
-- Replace contacto_entrega and telefone_entrega with peso, nr_viaturas, nr_paletes

-- Add new columns
ALTER TABLE public.logistica_entregas
  ADD COLUMN IF NOT EXISTS peso text NULL,
  ADD COLUMN IF NOT EXISTS nr_viaturas text NULL,
  ADD COLUMN IF NOT EXISTS nr_paletes text NULL;

-- Add comments to document the field constraints
COMMENT ON COLUMN public.logistica_entregas.peso IS 'Peso - máximo 6 caracteres';
COMMENT ON COLUMN public.logistica_entregas.nr_viaturas IS 'Número de viaturas - máximo 3 caracteres';
COMMENT ON COLUMN public.logistica_entregas.nr_paletes IS 'Número de paletes - máximo 4 caracteres';

-- Optional: Drop old fields if you want to remove them completely
-- Uncomment the lines below if you want to remove contacto_entrega and telefone_entrega
-- ALTER TABLE public.logistica_entregas DROP COLUMN IF EXISTS contacto_entrega;
-- ALTER TABLE public.logistica_entregas DROP COLUMN IF EXISTS telefone_entrega;
