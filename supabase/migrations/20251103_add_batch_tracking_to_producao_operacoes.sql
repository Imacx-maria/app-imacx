-- Add batch tracking fields to producao_operacoes table
-- These fields enable splitting large operations across multiple operators/machines
-- Example: 100 plates total -> 50 on machine1, 50 on machine2

ALTER TABLE producao_operacoes
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS batch_parent_id UUID REFERENCES producao_operacoes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_placas INTEGER,
ADD COLUMN IF NOT EXISTS placas_neste_batch INTEGER;

COMMENT ON COLUMN producao_operacoes.batch_id IS
'Groups related operations that are part of the same split batch. All operations in a batch share the same batch_id.';

COMMENT ON COLUMN producao_operacoes.batch_parent_id IS
'References the original operation if this is a duplicate/split operation. NULL for original operations.';

COMMENT ON COLUMN producao_operacoes.total_placas IS
'Total number of plates across all batches for this item. Used to track partial completion.';

COMMENT ON COLUMN producao_operacoes.placas_neste_batch IS
'Number of plates assigned to this specific batch/session. Sum of all placas_neste_batch should equal total_placas.';

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_batch_id
ON producao_operacoes(batch_id)
WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_batch_parent
ON producao_operacoes(batch_parent_id)
WHERE batch_parent_id IS NOT NULL;
