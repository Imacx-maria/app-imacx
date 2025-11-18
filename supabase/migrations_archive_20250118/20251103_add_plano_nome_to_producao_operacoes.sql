-- Add plano_nome field to producao_operacoes table
-- This field stores the plan name/identifier for operations (e.g., "Plano A", "Plano B")
-- Used to track which designer plan this operation corresponds to

ALTER TABLE producao_operacoes
ADD COLUMN IF NOT EXISTS plano_nome TEXT;

COMMENT ON COLUMN producao_operacoes.plano_nome IS
'Plan name for this operation (e.g., "Plano A: Costas e Crowner"). Used to identify different plans for the same item.';

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_plano_nome
ON producao_operacoes(plano_nome)
WHERE plano_nome IS NOT NULL;
