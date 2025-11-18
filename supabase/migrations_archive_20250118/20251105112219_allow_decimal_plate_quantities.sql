-- Allow decimal quantities in designer_planos table
-- This enables fractional plate quantities like 1.5, 20.5, etc.
ALTER TABLE designer_planos 
  ALTER COLUMN quantidade TYPE NUMERIC(10, 2);

-- Allow decimal quantities in producao_operacoes table  
ALTER TABLE producao_operacoes 
  ALTER COLUMN num_placas_print TYPE NUMERIC(10, 2);

ALTER TABLE producao_operacoes 
  ALTER COLUMN num_placas_corte TYPE NUMERIC(10, 2);

-- Add helpful comments to document the decimal support
COMMENT ON COLUMN designer_planos.quantidade IS 'Number of plates (can be fractional, e.g., 1.5). For stock deduction, ceiling value is used (1.5 → 2 plates deducted).';
COMMENT ON COLUMN producao_operacoes.num_placas_print IS 'Number of plates for printing (can be fractional, e.g., 20.5). For stock deduction, ceiling value is used (20.5 → 21 plates deducted).';
COMMENT ON COLUMN producao_operacoes.num_placas_corte IS 'Number of plates for cutting (can be fractional, e.g., 15.5). For stock deduction, ceiling value is used (15.5 → 16 plates deducted).';
