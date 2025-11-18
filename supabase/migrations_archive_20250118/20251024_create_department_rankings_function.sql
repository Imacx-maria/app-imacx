-- Create function to get department rankings with YTD comparisons
CREATE OR REPLACE FUNCTION get_department_rankings_ytd()
RETURNS TABLE (
  departamento TEXT,
  faturacao NUMERIC,
  faturacao_anterior NUMERIC,
  faturacao_variacao NUMERIC,
  notas_credito NUMERIC,
  notas_credito_anterior NUMERIC,
  notas_credito_variacao NUMERIC,
  num_faturas BIGINT,
  num_faturas_anterior BIGINT,
  num_faturas_variacao NUMERIC,
  num_notas BIGINT,
  num_notas_anterior BIGINT,
  num_notas_variacao NUMERIC,
  ticket_medio NUMERIC,
  ticket_medio_anterior NUMERIC,
  ticket_medio_variacao NUMERIC,
  orcamentos_valor NUMERIC,
  orcamentos_valor_anterior NUMERIC,
  orcamentos_valor_variacao NUMERIC,
  orcamentos_qtd BIGINT,
  orcamentos_qtd_anterior BIGINT,
  orcamentos_qtd_variacao NUMERIC,
  taxa_conversao NUMERIC,
  taxa_conversao_anterior NUMERIC,
  taxa_conversao_variacao NUMERIC
)
LANGUAGE SQL
STABLE
AS $$

WITH current_year_data AS (
  -- Current Year (2025) Metrics by Department
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    
    -- Facturação (excluding anulado)
    SUM(CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.net_value 
      ELSE 0 
    END) as faturacao,
    
    -- Notas Crédito
    ABS(SUM(CASE 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.net_value 
      ELSE 0 
    END)) as notas_credito,
    
    -- Receita Líquida (Faturas - Notas Crédito)
    SUM(CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.net_value 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.net_value 
      ELSE 0 
    END) as receita_liquida,
    
    -- Nº Faturas
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.invoice_id 
    END) as num_faturas,
    
    -- Nº Notas Crédito
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.invoice_id 
    END) as num_notas,
    
    -- Ticket Médio
    CASE 
      WHEN COUNT(DISTINCT CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.invoice_id 
      END) > 0
      THEN SUM(CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.net_value 
        ELSE 0 
      END) / COUNT(DISTINCT CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.invoice_id 
      END)
      ELSE 0
    END as ticket_medio
    
  FROM phc.ft
  LEFT JOIN phc.cl ON ft.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  WHERE EXTRACT(YEAR FROM ft.invoice_date) = 2025
    AND ft.document_type IN ('Factura', 'Nota de Crédito')
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
previous_year_data AS (
  -- Previous Year (2024) Same Period Metrics by Department - from 2years_ft
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    
    SUM(CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.net_value 
      ELSE 0 
    END) as faturacao_anterior,
    
    ABS(SUM(CASE 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.net_value 
      ELSE 0 
    END)) as notas_credito_anterior,
    
    SUM(CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.net_value 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.net_value 
      ELSE 0 
    END) as receita_liquida_anterior,
    
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.invoice_id 
    END) as num_faturas_anterior,
    
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Nota de Crédito' 
      THEN ft.invoice_id 
    END) as num_notas_anterior,
    
    CASE 
      WHEN COUNT(DISTINCT CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.invoice_id 
      END) > 0
      THEN SUM(CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.net_value 
        ELSE 0 
      END) / COUNT(DISTINCT CASE 
        WHEN ft.document_type = 'Factura' 
          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
        THEN ft.invoice_id 
      END)
      ELSE 0
    END as ticket_medio_anterior
    
  FROM phc."2years_ft" ft
  LEFT JOIN phc.cl ON ft.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  WHERE EXTRACT(YEAR FROM ft.invoice_date) = 2024
    AND ft.invoice_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
    AND ft.document_type IN ('Factura', 'Nota de Crédito')
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
orcamentos_current AS (
  -- Current Year Orçamentos by Department
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    SUM(bo.total_value) as orcamentos_valor,
    COUNT(*) as orcamentos_qtd
  FROM phc.bo
  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  WHERE EXTRACT(YEAR FROM bo.document_date) = 2025
    AND bo.document_type = 'Orçamento'
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
orcamentos_previous AS (
  -- Previous Year Orçamentos by Department - from 2years_bo
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    SUM(bo.total_value) as orcamentos_valor_anterior,
    COUNT(*) as orcamentos_qtd_anterior
  FROM phc."2years_bo" bo
  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  WHERE EXTRACT(YEAR FROM bo.document_date) = 2024
    AND bo.document_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
    AND bo.document_type = 'Orçamento'
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
taxa_conversao AS (
  -- Conversion Rate Calculation
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    COUNT(DISTINCT CASE WHEN bo.document_type = 'Orçamento' THEN bo.customer_id END) as total_orcamentos_clientes,
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.customer_id 
    END) as total_faturas_clientes
  FROM phc.bo
  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  LEFT JOIN phc.ft ON bo.customer_id = ft.customer_id 
    AND EXTRACT(YEAR FROM ft.invoice_date) = 2025
  WHERE EXTRACT(YEAR FROM bo.document_date) = 2025
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
taxa_conversao_anterior AS (
  -- Previous Year Conversion Rate - from 2years tables
  SELECT 
    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,
    COUNT(DISTINCT CASE WHEN bo.document_type = 'Orçamento' THEN bo.customer_id END) as total_orcamentos_clientes_anterior,
    COUNT(DISTINCT CASE 
      WHEN ft.document_type = 'Factura' 
        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 
      THEN ft.customer_id 
    END) as total_faturas_clientes_anterior
  FROM phc."2years_bo" bo
  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id
  LEFT JOIN public.user_name_mapping unm 
    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))
    AND unm.active = true
    AND unm.sales = true
  LEFT JOIN phc."2years_ft" ft ON bo.customer_id = ft.customer_id 
    AND EXTRACT(YEAR FROM ft.invoice_date) = 2024
    AND ft.invoice_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
  WHERE EXTRACT(YEAR FROM bo.document_date) = 2024
    AND bo.document_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')
),
combined_results AS (
SELECT 
  cy.departamento,
  
  -- Facturação
  cy.faturacao,
  COALESCE(py.faturacao_anterior, 0) as faturacao_anterior,
  CASE 
    WHEN COALESCE(py.faturacao_anterior, 0) > 0 
    THEN ROUND(((cy.faturacao - py.faturacao_anterior) / py.faturacao_anterior * 100)::numeric, 1)
    ELSE 0 
  END as faturacao_variacao,
  
  -- Notas Crédito
  cy.notas_credito,
  COALESCE(py.notas_credito_anterior, 0) as notas_credito_anterior,
  CASE 
    WHEN COALESCE(py.notas_credito_anterior, 0) > 0 
    THEN ROUND(((cy.notas_credito - py.notas_credito_anterior) / py.notas_credito_anterior * 100)::numeric, 1)
    ELSE 0 
  END as notas_credito_variacao,
  
  -- Nº Faturas
  cy.num_faturas,
  COALESCE(py.num_faturas_anterior, 0) as num_faturas_anterior,
  CASE 
    WHEN COALESCE(py.num_faturas_anterior, 0) > 0 
    THEN ROUND(((cy.num_faturas - py.num_faturas_anterior)::numeric / py.num_faturas_anterior * 100)::numeric, 1)
    ELSE 0 
  END as num_faturas_variacao,
  
  -- Nº Notas
  cy.num_notas,
  COALESCE(py.num_notas_anterior, 0) as num_notas_anterior,
  CASE 
    WHEN COALESCE(py.num_notas_anterior, 0) > 0 
    THEN ROUND(((cy.num_notas - py.num_notas_anterior)::numeric / py.num_notas_anterior * 100)::numeric, 1)
    ELSE 0 
  END as num_notas_variacao,
  
  -- Ticket Médio
  ROUND(cy.ticket_medio::numeric, 2) as ticket_medio,
  ROUND(COALESCE(py.ticket_medio_anterior, 0)::numeric, 2) as ticket_medio_anterior,
  CASE 
    WHEN COALESCE(py.ticket_medio_anterior, 0) > 0 
    THEN ROUND(((cy.ticket_medio - py.ticket_medio_anterior) / py.ticket_medio_anterior * 100)::numeric, 1)
    ELSE 0 
  END as ticket_medio_variacao,
  
  -- Orçamentos Valor
  COALESCE(oc.orcamentos_valor, 0) as orcamentos_valor,
  COALESCE(op.orcamentos_valor_anterior, 0) as orcamentos_valor_anterior,
  CASE 
    WHEN COALESCE(op.orcamentos_valor_anterior, 0) > 0 
    THEN ROUND(((COALESCE(oc.orcamentos_valor, 0) - op.orcamentos_valor_anterior) / op.orcamentos_valor_anterior * 100)::numeric, 1)
    ELSE 0 
  END as orcamentos_valor_variacao,
  
  -- Orçamentos QTD
  COALESCE(oc.orcamentos_qtd, 0) as orcamentos_qtd,
  COALESCE(op.orcamentos_qtd_anterior, 0) as orcamentos_qtd_anterior,
  CASE 
    WHEN COALESCE(op.orcamentos_qtd_anterior, 0) > 0 
    THEN ROUND(((COALESCE(oc.orcamentos_qtd, 0) - op.orcamentos_qtd_anterior)::numeric / op.orcamentos_qtd_anterior * 100)::numeric, 1)
    ELSE 0 
  END as orcamentos_qtd_variacao,
  
  -- Taxa Conversão
  CASE 
    WHEN COALESCE(tc.total_orcamentos_clientes, 0) > 0 
    THEN ROUND((tc.total_faturas_clientes::numeric / tc.total_orcamentos_clientes * 100)::numeric, 1)
    ELSE 0 
  END as taxa_conversao,
  CASE 
    WHEN COALESCE(tca.total_orcamentos_clientes_anterior, 0) > 0 
    THEN ROUND((tca.total_faturas_clientes_anterior::numeric / tca.total_orcamentos_clientes_anterior * 100)::numeric, 1)
    ELSE 0 
  END as taxa_conversao_anterior,
  CASE 
    WHEN COALESCE(tca.total_orcamentos_clientes_anterior, 0) > 0 
    THEN ROUND((
      (tc.total_faturas_clientes::numeric / tc.total_orcamentos_clientes * 100) -
      (tca.total_faturas_clientes_anterior::numeric / tca.total_orcamentos_clientes_anterior * 100)
    )::numeric, 1)
    ELSE 0 
  END as taxa_conversao_variacao

FROM current_year_data cy
LEFT JOIN previous_year_data py ON cy.departamento = py.departamento
LEFT JOIN orcamentos_current oc ON cy.departamento = oc.departamento
LEFT JOIN orcamentos_previous op ON cy.departamento = op.departamento
LEFT JOIN taxa_conversao tc ON cy.departamento = tc.departamento
LEFT JOIN taxa_conversao_anterior tca ON cy.departamento = tca.departamento

-- Add a TOTAL row
UNION ALL

SELECT 
  'TOTAL' as departamento,
  SUM(cy.faturacao),
  SUM(COALESCE(py.faturacao_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(py.faturacao_anterior, 0)) > 0 
    THEN ROUND(((SUM(cy.faturacao) - SUM(py.faturacao_anterior)) / SUM(py.faturacao_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  SUM(cy.notas_credito),
  SUM(COALESCE(py.notas_credito_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(py.notas_credito_anterior, 0)) > 0 
    THEN ROUND(((SUM(cy.notas_credito) - SUM(py.notas_credito_anterior)) / SUM(py.notas_credito_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  SUM(cy.num_faturas),
  SUM(COALESCE(py.num_faturas_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(py.num_faturas_anterior, 0)) > 0 
    THEN ROUND(((SUM(cy.num_faturas) - SUM(py.num_faturas_anterior))::numeric / SUM(py.num_faturas_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  SUM(cy.num_notas),
  SUM(COALESCE(py.num_notas_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(py.num_notas_anterior, 0)) > 0 
    THEN ROUND(((SUM(cy.num_notas) - SUM(py.num_notas_anterior))::numeric / SUM(py.num_notas_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  ROUND((SUM(cy.faturacao) / NULLIF(SUM(cy.num_faturas), 0))::numeric, 2),
  ROUND((SUM(COALESCE(py.faturacao_anterior, 0)) / NULLIF(SUM(py.num_faturas_anterior), 0))::numeric, 2),
  CASE 
    WHEN (SUM(COALESCE(py.faturacao_anterior, 0)) / NULLIF(SUM(py.num_faturas_anterior), 0)) > 0 
    THEN ROUND((((SUM(cy.faturacao) / NULLIF(SUM(cy.num_faturas), 0)) - 
                 (SUM(py.faturacao_anterior) / NULLIF(SUM(py.num_faturas_anterior), 0))) / 
                 (SUM(py.faturacao_anterior) / NULLIF(SUM(py.num_faturas_anterior), 0)) * 100)::numeric, 1)
    ELSE 0 
  END,
  SUM(COALESCE(oc.orcamentos_valor, 0)),
  SUM(COALESCE(op.orcamentos_valor_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(op.orcamentos_valor_anterior, 0)) > 0 
    THEN ROUND(((SUM(COALESCE(oc.orcamentos_valor, 0)) - SUM(op.orcamentos_valor_anterior)) / SUM(op.orcamentos_valor_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  SUM(COALESCE(oc.orcamentos_qtd, 0)),
  SUM(COALESCE(op.orcamentos_qtd_anterior, 0)),
  CASE 
    WHEN SUM(COALESCE(op.orcamentos_qtd_anterior, 0)) > 0 
    THEN ROUND(((SUM(COALESCE(oc.orcamentos_qtd, 0)) - SUM(op.orcamentos_qtd_anterior))::numeric / SUM(op.orcamentos_qtd_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  CASE 
    WHEN SUM(COALESCE(tc.total_orcamentos_clientes, 0)) > 0 
    THEN ROUND((SUM(tc.total_faturas_clientes)::numeric / SUM(tc.total_orcamentos_clientes) * 100)::numeric, 1)
    ELSE 0 
  END,
  CASE 
    WHEN SUM(COALESCE(tca.total_orcamentos_clientes_anterior, 0)) > 0 
    THEN ROUND((SUM(tca.total_faturas_clientes_anterior)::numeric / SUM(tca.total_orcamentos_clientes_anterior) * 100)::numeric, 1)
    ELSE 0 
  END,
  CASE 
    WHEN SUM(COALESCE(tca.total_orcamentos_clientes_anterior, 0)) > 0 
    THEN ROUND((
      (SUM(tc.total_faturas_clientes)::numeric / SUM(tc.total_orcamentos_clientes) * 100) -
      (SUM(tca.total_faturas_clientes_anterior)::numeric / SUM(tca.total_orcamentos_clientes_anterior) * 100)
    )::numeric, 1)
    ELSE 0 
  END
FROM current_year_data cy
LEFT JOIN previous_year_data py ON cy.departamento = py.departamento
LEFT JOIN orcamentos_current oc ON cy.departamento = oc.departamento
LEFT JOIN orcamentos_previous op ON cy.departamento = op.departamento
LEFT JOIN taxa_conversao tc ON cy.departamento = tc.departamento
LEFT JOIN taxa_conversao_anterior tca ON cy.departamento = tca.departamento
)
SELECT * FROM combined_results
ORDER BY 
  CASE WHEN departamento = 'TOTAL' THEN 1 ELSE 0 END,
  faturacao DESC;

$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_department_rankings_ytd() TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_rankings_ytd() TO anon;

