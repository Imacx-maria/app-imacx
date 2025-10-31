-- Migration: Add source_impressao_id for linking operations
-- Date: 2025-10-30
-- Purpose: Enable proper linking between Impressão and Corte operations

-- Add source_impressao_id column to link cutting operations to their source print operations
ALTER TABLE producao_operacoes
ADD COLUMN IF NOT EXISTS source_impressao_id uuid REFERENCES producao_operacoes(id) ON DELETE SET NULL;

-- Add comment explaining the column
COMMENT ON COLUMN producao_operacoes.source_impressao_id IS
'Links Corte operations to their source Impressão operation. NULL for standalone/loose plate cuts.';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_producao_operacoes_item_id
ON producao_operacoes(item_id);

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_source_impressao
ON producao_operacoes(source_impressao_id)
WHERE source_impressao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_tipo_op
ON producao_operacoes("Tipo_Op");

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_concluido
ON producao_operacoes(concluido);

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_data_operacao
ON producao_operacoes(data_operacao);

-- Add check constraint to ensure source_impressao_id only used for Corte operations
ALTER TABLE producao_operacoes
ADD CONSTRAINT chk_source_impressao_only_for_corte
CHECK (
  (source_impressao_id IS NULL) OR
  ("Tipo_Op" = 'Corte')
);

-- Add comment
COMMENT ON CONSTRAINT chk_source_impressao_only_for_corte ON producao_operacoes IS
'Ensures that source_impressao_id can only be set for Corte operations.';
