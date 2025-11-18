-- ============================================================================
-- FUNCTION: get_kpis_mtd_ytd
-- Descrição: Retorna KPIs de receita, orçamentos, faturas e conversão
-- Data: 2025-11-15
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_mtd_ytd(
    p_period text DEFAULT 'ytd'  -- 'mtd' ou 'ytd'
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    v_start_date_prev date;
    v_end_date_prev date;
    v_result json;
BEGIN
    -- Calcular datas baseado no período
    v_end_date := CURRENT_DATE;

    IF p_period = 'mtd' THEN
        -- Month-to-Date
        v_start_date := DATE_TRUNC('month', CURRENT_DATE)::date;
        v_start_date_prev := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')::date;
        v_end_date_prev := (CURRENT_DATE - INTERVAL '1 year')::date;
    ELSE
        -- Year-to-Date (default)
        v_start_date := DATE_TRUNC('year', CURRENT_DATE)::date;
        v_start_date_prev := DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::date;
        v_end_date_prev := (CURRENT_DATE - INTERVAL '1 year')::date;
    END IF;

    -- Construir resultado
    WITH current_period AS (
        SELECT
            -- Faturas (Receita)
            COALESCE(SUM(ft.etotal), 0) AS receita,
            COUNT(DISTINCT ft.ftstamp) AS faturas_qtd,
            COUNT(DISTINCT ft.no) AS clientes_qtd,
            CASE
                WHEN COUNT(DISTINCT ft.ftstamp) > 0
                THEN COALESCE(SUM(ft.etotal), 0) / COUNT(DISTINCT ft.ftstamp)
                ELSE 0
            END AS ticket_medio
        FROM phc.ft ft
        WHERE ft.fdata >= v_start_date
          AND ft.fdata <= v_end_date
          AND ft.anulado = false
          AND ft.estab = 1
    ),
    current_orcamentos AS (
        SELECT
            COALESCE(SUM(bo.ettotal), 0) AS orcamentos_valor,
            COUNT(DISTINCT bo.bostamp) AS orcamentos_qtd
        FROM phc.bo bo
        WHERE bo.dataobra >= v_start_date
          AND bo.dataobra <= v_end_date
          AND COALESCE(bo.anulado, false) = false
          AND bo.estab = 1
    ),
    previous_period AS (
        SELECT
            COALESCE(SUM(ft.etotal), 0) AS receita,
            COUNT(DISTINCT ft.ftstamp) AS faturas_qtd,
            COUNT(DISTINCT ft.no) AS clientes_qtd
        FROM phc.ft ft
        WHERE ft.fdata >= v_start_date_prev
          AND ft.fdata <= v_end_date_prev
          AND ft.anulado = false
          AND ft.estab = 1
    ),
    previous_orcamentos AS (
        SELECT
            COALESCE(SUM(bo.ettotal), 0) AS orcamentos_valor,
            COUNT(DISTINCT bo.bostamp) AS orcamentos_qtd
        FROM phc.bo bo
        WHERE bo.dataobra >= v_start_date_prev
          AND bo.dataobra <= v_end_date_prev
          AND COALESCE(bo.anulado, false) = false
          AND bo.estab = 1
    )
    SELECT json_build_object(
        'receita', cp.receita,
        'orcamentos_valor', co.orcamentos_valor,
        'orcamentos_qtd', co.orcamentos_qtd,
        'faturas_qtd', cp.faturas_qtd,
        'clientes_qtd', cp.clientes_qtd,
        'ticket_medio', cp.ticket_medio,
        'conversao', CASE
            WHEN co.orcamentos_valor > 0
            THEN (cp.receita / co.orcamentos_valor * 100)::numeric(10,2)
            ELSE 0
        END,
        'lytd', json_build_object(
            'receita', pp.receita,
            'orcamentos_qtd', po.orcamentos_qtd,
            'faturas_qtd', pp.faturas_qtd,
            'clientes_qtd', pp.clientes_qtd
        )
    ) INTO v_result
    FROM current_period cp, current_orcamentos co, previous_period pp, previous_orcamentos po;

    RETURN v_result;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_kpis_mtd_ytd IS
    'Retorna KPIs MTD ou YTD com comparação ao ano anterior';

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_kpis_mtd_ytd TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_mtd_ytd TO service_role;
