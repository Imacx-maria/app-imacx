-- ============================================================================
-- VIEW: vw_orcamentos_pipeline
-- Descrição: View de orçamentos do PHC para análise de pipeline comercial
-- Data: 2025-11-15
-- ============================================================================

-- Drop existing view first
DROP VIEW IF EXISTS public.vw_orcamentos_pipeline;

-- Create new view
CREATE VIEW public.vw_orcamentos_pipeline AS
SELECT
    -- Identificação
    bo.document_id AS orcamento_id,
    bo.document_number AS orcamento_numero,
    bo.customer_id,

    -- Cliente (join com tabela cl)
    COALESCE(cl.customer_name, 'Cliente não identificado') AS cliente_nome,

    -- Datas
    bo.document_date,
    ft.invoice_date,

    -- Valores
    bo.total_value,

    -- Status (baseado se foi faturado ou não)
    CASE
        WHEN ft.invoice_id IS NOT NULL AND ft.anulado = 'false' THEN 'APROVADO'
        WHEN ft.invoice_id IS NULL AND bo.document_date < CURRENT_DATE - INTERVAL '60 days' THEN 'PERDIDO'
        ELSE 'PENDENTE'
    END AS status,

    -- Motivo (observações)
    bo.observacoes AS motivo,

    -- Departamento (baseado no departamento do vendedor via user_siglas -> profiles -> departamentos)
    COALESCE(d.nome, 'IMACX') AS departamento,

    -- Vendedor
    COALESCE(ft.salesperson_name, bo.created_by, 'N/A') AS salesperson,

    -- Fatura relacionada
    ft.invoice_id,
    ft.invoice_number::text AS invoice_numero

FROM phc.bo bo
LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
LEFT JOIN phc.ft ft ON bo.customer_id = ft.customer_id
LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id

WHERE
    bo.document_date >= '2023-01-01';  -- Últimos 3 anos

-- Comentários
COMMENT ON VIEW public.vw_orcamentos_pipeline IS
    'View de orçamentos PHC com status, departamento e ligação a faturas para análise de pipeline comercial';

-- Permissões
GRANT SELECT ON public.vw_orcamentos_pipeline TO authenticated;
GRANT SELECT ON public.vw_orcamentos_pipeline TO service_role;
