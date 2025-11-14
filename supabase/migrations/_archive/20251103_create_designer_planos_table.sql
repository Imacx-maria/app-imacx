-- Create designer_planos table
-- Stores pre-planning data created by designers during paginação phase
-- Each plan represents a specific operation (Print or Cut) with full specifications
-- Example: Item "Expositor Cartão" might have:
--   Plano A: INCA, Cartão, 4.1mm, Branco, Print, 10, 4/0, "Costas e Crowner"
--   Plano B: INCA, Favo, 16mm, Estucado, Print, 20, 4/4, "Laterais e Prateleiras"
--   Plano C: [Cutting machine], Cartão, 2.8mm, Kraft, Corte, 10, 0/0, "Caixa de transporte"

CREATE TABLE IF NOT EXISTS designer_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items_base(id) ON DELETE CASCADE,
  designer_item_id UUID REFERENCES designer_items(id) ON DELETE CASCADE,

  -- Plan identification
  plano_nome TEXT NOT NULL,
  plano_ordem INTEGER DEFAULT 1, -- Order of plans (A=1, B=2, C=3, etc.)

  -- Operation details
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('Impressao', 'Corte', 'Impressao_Flexiveis')),
  maquina TEXT, -- Machine ID/name

  -- Material specification (cascading)
  material TEXT, -- e.g., "Cartão", "Favo"
  caracteristicas TEXT, -- e.g., "4.1mm", "16mm"
  cor TEXT, -- e.g., "Branco", "Kraft"
  material_id UUID REFERENCES materiais(id), -- Resolved material ID

  -- Print specifications
  cores TEXT, -- e.g., "4/4", "4/0", "0/0"
  quantidade INTEGER, -- Number of plates/pieces

  -- Notes
  notas TEXT,

  -- Status tracking
  criado_em_producao BOOLEAN DEFAULT FALSE,
  producao_operacao_id UUID REFERENCES producao_operacoes(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(item_id, plano_nome)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_designer_planos_item_id
ON designer_planos(item_id);

CREATE INDEX IF NOT EXISTS idx_designer_planos_designer_item_id
ON designer_planos(designer_item_id);

CREATE INDEX IF NOT EXISTS idx_designer_planos_tipo_operacao
ON designer_planos(tipo_operacao);

CREATE INDEX IF NOT EXISTS idx_designer_planos_criado_em_producao
ON designer_planos(criado_em_producao);

CREATE INDEX IF NOT EXISTS idx_designer_planos_plano_ordem
ON designer_planos(plano_ordem);

-- Comments for documentation
COMMENT ON TABLE designer_planos IS
'Stores pre-planning data created by designers during paginação phase. Each plan represents a specific operation (Print or Cut) with full material and machine specifications.';

COMMENT ON COLUMN designer_planos.plano_nome IS
'Plan identifier (e.g., "Plano A", "Plano B"). Must be unique per item.';

COMMENT ON COLUMN designer_planos.plano_ordem IS
'Numerical order of plans for sorting (1, 2, 3, etc.). Used to maintain plan sequence.';

COMMENT ON COLUMN designer_planos.tipo_operacao IS
'Type of operation: Impressao (Print), Corte (Cut), or Impressao_Flexiveis (Flexible Print).';

COMMENT ON COLUMN designer_planos.maquina IS
'Machine identifier or name to be used for this operation.';

COMMENT ON COLUMN designer_planos.material IS
'Material type (first level of cascading selection).';

COMMENT ON COLUMN designer_planos.caracteristicas IS
'Material characteristics (second level of cascading selection).';

COMMENT ON COLUMN designer_planos.cor IS
'Material color (third level of cascading selection).';

COMMENT ON COLUMN designer_planos.material_id IS
'Resolved material ID from materiais table based on cascading selection.';

COMMENT ON COLUMN designer_planos.cores IS
'Print color specification (e.g., "4/4", "4/0"). Format: front_colors/back_colors.';

COMMENT ON COLUMN designer_planos.quantidade IS
'Number of plates or pieces for this plan.';

COMMENT ON COLUMN designer_planos.criado_em_producao IS
'Indicates if this plan has been created as an operation in producao_operacoes. Used to track which plans have been executed.';

COMMENT ON COLUMN designer_planos.producao_operacao_id IS
'Links to the created production operation when plan is executed. NULL if not yet created.';

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_designer_planos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_designer_planos_updated_at
  BEFORE UPDATE ON designer_planos
  FOR EACH ROW
  EXECUTE FUNCTION update_designer_planos_updated_at();
