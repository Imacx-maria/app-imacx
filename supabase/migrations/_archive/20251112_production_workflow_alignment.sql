-- Migration: Align production operations with Print & Cut Workflow Spec
-- Date: 2025-01-12
-- Purpose: Add fields for planned quantities, job grouping, and source record tracking

-- Ensure UUID extension is enabled (using pgcrypto which is default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add planned quantity fields for source records
ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS QT_print_planned INTEGER NULL;

COMMENT ON COLUMN public.producao_operacoes.QT_print_planned IS 'Planned quantity for print operations (from designer)';

ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS QT_corte_planned INTEGER NULL;

COMMENT ON COLUMN public.producao_operacoes.QT_corte_planned IS 'Planned quantity for cut operations (from designer or cut-only jobs)';

-- 2. Add job grouping identifiers to link split operations
ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS print_job_id UUID NULL;

COMMENT ON COLUMN public.producao_operacoes.print_job_id IS 'Groups all print operation splits for the same job';

ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS cut_job_id UUID NULL;

COMMENT ON COLUMN public.producao_operacoes.cut_job_id IS 'Groups all cut operation splits for the same job';

-- 3. Add flag to identify source/planning records vs execution records
ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS is_source_record BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.producao_operacoes.is_source_record IS 'TRUE for planning records with quantities, FALSE for execution/split records';

-- 4. Add parent reference for simple duplication tracking (replaces complex batch system)
ALTER TABLE public.producao_operacoes
ADD COLUMN IF NOT EXISTS parent_operation_id UUID NULL REFERENCES public.producao_operacoes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.producao_operacoes.parent_operation_id IS 'References the source operation when this is a duplicate/split';

-- 5. Add constraints to ensure data integrity
ALTER TABLE public.producao_operacoes
ADD CONSTRAINT chk_print_planned_for_print_ops
CHECK (
  (QT_print_planned IS NULL) OR
  ("Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis'))
);

ALTER TABLE public.producao_operacoes
ADD CONSTRAINT chk_corte_planned_for_corte_ops
CHECK (
  (QT_corte_planned IS NULL) OR
  ("Tipo_Op" = 'Corte')
);

-- Only source records should have planned quantities
ALTER TABLE public.producao_operacoes
ADD CONSTRAINT chk_planned_only_on_source
CHECK (
  (NOT is_source_record) OR
  (QT_print_planned IS NOT NULL OR QT_corte_planned IS NOT NULL)
);

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_producao_operacoes_print_job_id
ON public.producao_operacoes(print_job_id)
WHERE print_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_cut_job_id
ON public.producao_operacoes(cut_job_id)
WHERE cut_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_source_records
ON public.producao_operacoes(is_source_record)
WHERE is_source_record = true;

CREATE INDEX IF NOT EXISTS idx_producao_operacoes_parent_operation
ON public.producao_operacoes(parent_operation_id)
WHERE parent_operation_id IS NOT NULL;

-- 7. Create function to validate quantity constraints
CREATE OR REPLACE FUNCTION validate_operation_quantities()
RETURNS TRIGGER AS $$
DECLARE
  v_total_executed NUMERIC;
  v_planned_qty INTEGER;
  v_total_printed NUMERIC;
  v_job_id UUID;
BEGIN
  -- Skip validation for source records
  IF NEW.is_source_record THEN
    RETURN NEW;
  END IF;

  -- Validate print operations
  IF NEW."Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis') AND NEW.print_job_id IS NOT NULL THEN
    -- Get planned quantity from source record
    SELECT QT_print_planned INTO v_planned_qty
    FROM producao_operacoes
    WHERE print_job_id = NEW.print_job_id AND is_source_record = true
    LIMIT 1;

    -- Calculate total executed including this operation
    SELECT COALESCE(SUM(num_placas_print), 0) INTO v_total_executed
    FROM producao_operacoes
    WHERE print_job_id = NEW.print_job_id
      AND NOT is_source_record
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    v_total_executed := v_total_executed + COALESCE(NEW.num_placas_print, 0);

    IF v_planned_qty IS NOT NULL AND v_total_executed > v_planned_qty THEN
      RAISE EXCEPTION 'Total printed (%) cannot exceed planned quantity (%)', v_total_executed, v_planned_qty;
    END IF;
  END IF;

  -- Validate cut operations linked to print
  IF NEW."Tipo_Op" = 'Corte' AND NEW.source_impressao_id IS NOT NULL THEN
    -- Get total printed for this print job
    SELECT COALESCE(SUM(num_placas_print), 0) INTO v_total_printed
    FROM producao_operacoes
    WHERE print_job_id = (
      SELECT print_job_id FROM producao_operacoes WHERE id = NEW.source_impressao_id LIMIT 1
    ) AND NOT is_source_record;

    -- Calculate total cut including this operation
    SELECT COALESCE(SUM(num_placas_corte), 0) INTO v_total_executed
    FROM producao_operacoes
    WHERE source_impressao_id = NEW.source_impressao_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    v_total_executed := v_total_executed + COALESCE(NEW.num_placas_corte, 0);

    IF v_total_executed > v_total_printed THEN
      RAISE EXCEPTION 'Total cut (%) cannot exceed total printed (%)', v_total_executed, v_total_printed;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for quantity validation
DROP TRIGGER IF EXISTS trg_validate_operation_quantities ON producao_operacoes;
CREATE TRIGGER trg_validate_operation_quantities
BEFORE INSERT OR UPDATE ON producao_operacoes
FOR EACH ROW
EXECUTE FUNCTION validate_operation_quantities();

-- 9. Migrate existing data (optional - review before running)
-- This identifies potential source records based on existing patterns
UPDATE producao_operacoes
SET is_source_record = true,
    print_job_id = CASE
      WHEN "Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis') THEN id
      ELSE print_job_id
    END,
    cut_job_id = CASE
      WHEN "Tipo_Op" = 'Corte' AND source_impressao_id IS NULL THEN id
      ELSE cut_job_id
    END,
    QT_print_planned = CASE
      WHEN "Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis') THEN COALESCE("QT_print", num_placas_print::integer)
      ELSE NULL
    END,
    QT_corte_planned = CASE
      WHEN "Tipo_Op" = 'Corte' AND source_impressao_id IS NULL THEN num_placas_corte::integer
      ELSE NULL
    END
WHERE batch_parent_id IS NULL
  AND (
    ("Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis') AND num_placas_print > 0) OR
    ("Tipo_Op" = 'Corte' AND source_impressao_id IS NULL AND num_placas_corte > 0)
  );

-- Update child records to reference their parent's job IDs
UPDATE producao_operacoes child
SET print_job_id = parent.print_job_id,
    cut_job_id = parent.cut_job_id,
    parent_operation_id = parent.id
FROM producao_operacoes parent
WHERE child.batch_parent_id = parent.id;

-- 10. Add helper view for easier querying
CREATE OR REPLACE VIEW v_producao_operations_summary AS
SELECT
  job.id as job_id,
  job.folha_obra_id,
  job.item_id,
  job."Tipo_Op",
  job.plano_nome,
  job.QT_print_planned,
  job.QT_corte_planned,
  job.print_job_id,
  job.cut_job_id,
  COALESCE(SUM(exec.num_placas_print), 0) as total_printed,
  COALESCE(SUM(exec.num_placas_corte), 0) as total_cut,
  COUNT(exec.id) as num_splits,
  CASE
    WHEN job.QT_print_planned > 0 THEN
      ROUND((COALESCE(SUM(exec.num_placas_print), 0) / job.QT_print_planned::numeric) * 100, 2)
    WHEN job.QT_corte_planned > 0 THEN
      ROUND((COALESCE(SUM(exec.num_placas_corte), 0) / job.QT_corte_planned::numeric) * 100, 2)
    ELSE 0
  END as progress_percent
FROM producao_operacoes job
LEFT JOIN producao_operacoes exec ON
  (job.print_job_id IS NOT NULL AND exec.print_job_id = job.print_job_id AND NOT exec.is_source_record) OR
  (job.cut_job_id IS NOT NULL AND exec.cut_job_id = job.cut_job_id AND NOT exec.is_source_record)
WHERE job.is_source_record = true
GROUP BY job.id, job.folha_obra_id, job.item_id, job."Tipo_Op", job.plano_nome,
         job.QT_print_planned, job.QT_corte_planned, job.print_job_id, job.cut_job_id;

COMMENT ON VIEW v_producao_operations_summary IS 'Summary view showing planned vs executed quantities for production operations';
