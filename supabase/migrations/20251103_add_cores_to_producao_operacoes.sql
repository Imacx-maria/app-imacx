-- Add cores (print colors) field to producao_operacoes table
-- Format examples: "4/4" = 4 colors front/4 colors back
--                  "4/0" = 4 colors front only
--                  "0/0" = no print (for Corte operations)
--                  "5/3" = 5 colors front/3 colors back

ALTER TABLE producao_operacoes
ADD COLUMN IF NOT EXISTS cores TEXT;

COMMENT ON COLUMN producao_operacoes.cores IS
'Print colors specification (e.g., "4/4" = 4 colors front/4 colors back, "4/0" = 4 colors front only, "0/0" = no print for Corte operations)';

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_cores
ON producao_operacoes(cores)
WHERE cores IS NOT NULL;
