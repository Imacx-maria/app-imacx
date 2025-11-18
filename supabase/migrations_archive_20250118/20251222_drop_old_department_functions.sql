-- Drop old department analysis functions that are using SECURITY INVOKER
-- These are being replaced by the new SECURITY DEFINER versions with correct naming

DROP FUNCTION IF EXISTS get_department_clientes_analysis(TEXT, DATE, DATE, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_conversao_escaloes(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_faturas_escaloes(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_orcamentos_escaloes(TEXT, DATE, DATE);

-- Verify the correct functions remain
-- These should all be SECURITY DEFINER:
-- get_department_escaloes_orcamentos(TEXT, DATE, DATE)
-- get_department_escaloes_faturas(TEXT, DATE, DATE)
-- get_department_conversion_rates(TEXT, DATE, DATE)
-- get_department_customer_metrics(TEXT, DATE, DATE, DATE, DATE)
-- get_department_pipeline(TEXT, DATE)
