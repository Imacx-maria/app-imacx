-- Status Hunter RPC Functions
-- These functions provide optimized search queries for the Job Status Hunter chatbot

-- Search by FO Number
CREATE OR REPLACE FUNCTION status_hunter_search_fo(search_value TEXT)
RETURNS TABLE (
  id UUID,
  fo_number TEXT,
  numero_orc TEXT,
  cliente TEXT,
  campanha TEXT,
  created_at TIMESTAMPTZ,
  total_items BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fo.id,
    fo."Numero_do_" as fo_number,
    fo.numero_orc,
    fo."Nome" as cliente,
    fo."Trabalho" as campanha,
    fo.created_at,
    COUNT(DISTINCT ib.id) as total_items
  FROM folhas_obras fo
  LEFT JOIN items_base ib ON ib.folha_obra_id = fo.id
  WHERE fo."Numero_do_" ILIKE search_value
  GROUP BY fo.id, fo."Numero_do_", fo.numero_orc, fo."Nome", fo."Trabalho", fo.created_at
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search by ORC Number
CREATE OR REPLACE FUNCTION status_hunter_search_orc(search_value TEXT)
RETURNS TABLE (
  id UUID,
  fo_number TEXT,
  numero_orc TEXT,
  cliente TEXT,
  campanha TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fo.id,
    fo."Numero_do_" as fo_number,
    fo.numero_orc,
    fo."Nome" as cliente,
    fo."Trabalho" as campanha
  FROM folhas_obras fo
  WHERE fo.numero_orc ILIKE search_value
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search by Cliente (fuzzy)
CREATE OR REPLACE FUNCTION status_hunter_search_cliente(search_value TEXT)
RETURNS TABLE (
  id UUID,
  fo_number TEXT,
  cliente TEXT,
  campanha TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fo.id,
    fo."Numero_do_" as fo_number,
    fo."Nome" as cliente,
    fo."Trabalho" as campanha,
    fo.created_at
  FROM folhas_obras fo
  WHERE fo."Nome" ILIKE search_value
  ORDER BY fo.created_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search by Campanha
CREATE OR REPLACE FUNCTION status_hunter_search_campanha(search_value TEXT)
RETURNS TABLE (
  id UUID,
  fo_number TEXT,
  cliente TEXT,
  campanha TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    fo.id,
    fo."Numero_do_" as fo_number,
    fo."Nome" as cliente,
    fo."Trabalho" as campanha
  FROM folhas_obras fo
  LEFT JOIN items_base ib ON ib.folha_obra_id = fo.id
  LEFT JOIN logistica_entregas le ON le.item_id = ib.id
  WHERE fo."Trabalho" ILIKE search_value
     OR le.nome_campanha ILIKE search_value
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search by Item
CREATE OR REPLACE FUNCTION status_hunter_search_item(search_value TEXT)
RETURNS TABLE (
  id UUID,
  descricao TEXT,
  codigo TEXT,
  quantidade INTEGER,
  fo_number TEXT,
  cliente TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ib.id,
    ib.descricao,
    ib.codigo,
    ib.quantidade,
    fo."Numero_do_" as fo_number,
    fo."Nome" as cliente
  FROM items_base ib
  JOIN folhas_obras fo ON fo.id = ib.folha_obra_id
  WHERE ib.descricao ILIKE search_value
     OR ib.codigo ILIKE search_value
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search by Guia
CREATE OR REPLACE FUNCTION status_hunter_search_guia(search_value TEXT)
RETURNS TABLE (
  id UUID,
  guia TEXT,
  transportadora TEXT,
  local_entrega TEXT,
  saiu BOOLEAN,
  data_saida DATE,
  item TEXT,
  fo_number TEXT,
  cliente TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.id,
    le.guia,
    t.name as transportadora,
    a.nome_arm as local_entrega,
    le.saiu,
    le.data_saida,
    ib.descricao as item,
    fo."Numero_do_" as fo_number,
    fo."Nome" as cliente
  FROM logistica_entregas le
  JOIN items_base ib ON ib.id = le.item_id
  JOIN folhas_obras fo ON fo.id = ib.folha_obra_id
  LEFT JOIN transportadora t ON t.id = le.transportadora::uuid
  LEFT JOIN armazens a ON a.id = le.id_local_entrega
  WHERE le.guia ILIKE search_value
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full Status for Single FO
CREATE OR REPLACE FUNCTION status_hunter_full_status(fo_id UUID)
RETURNS TABLE (
  fo_number TEXT,
  orc_number TEXT,
  cliente TEXT,
  campanha TEXT,
  fo_created TIMESTAMPTZ,
  item_id UUID,
  item TEXT,
  qty INTEGER,
  designer TEXT,
  m1 BOOLEAN,
  data_maquete_enviada1 TIMESTAMPTZ,
  a1 BOOLEAN,
  data_aprovacao_recebida1 TIMESTAMPTZ,
  "R1" BOOLEAN,
  "R1_date" DATE,
  m2 BOOLEAN,
  data_maquete_enviada2 TIMESTAMPTZ,
  a2 BOOLEAN,
  data_aprovacao_recebida2 TIMESTAMPTZ,
  "R2" BOOLEAN,
  "R2_date" DATE,
  m3 BOOLEAN,
  data_maquete_enviada3 TIMESTAMPTZ,
  a3 BOOLEAN,
  data_aprovacao_recebida3 TIMESTAMPTZ,
  "R3" BOOLEAN,
  "R3_date" DATE,
  m4 BOOLEAN,
  data_maquete_enviada4 TIMESTAMPTZ,
  a4 BOOLEAN,
  data_aprovacao_recebida4 TIMESTAMPTZ,
  "R4" BOOLEAN,
  "R4_date" DATE,
  m5 BOOLEAN,
  data_maquete_enviada5 TIMESTAMPTZ,
  a5 BOOLEAN,
  data_aprovacao_recebida5 TIMESTAMPTZ,
  "R5" BOOLEAN,
  "R5_date" DATE,
  m6 BOOLEAN,
  data_maquete_enviada6 TIMESTAMPTZ,
  a6 BOOLEAN,
  data_aprovacao_recebida6 TIMESTAMPTZ,
  "R6" BOOLEAN,
  "R6_date" DATE,
  paginacao BOOLEAN,
  data_paginacao TIMESTAMPTZ,
  logistics_id UUID,
  delivered BOOLEAN,
  guia TEXT,
  transportadora TEXT,
  local_entrega TEXT,
  qty_delivered INTEGER,
  data_saida DATE,
  days_in_production INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fo."Numero_do_" as fo_number,
    fo.numero_orc as orc_number,
    fo."Nome" as cliente,
    fo."Trabalho" as campanha,
    fo.created_at as fo_created,
    ib.id as item_id,
    ib.descricao as item,
    ib.quantidade as qty,
    p.first_name as designer,
    di.maquete_enviada1 as m1, di.data_maquete_enviada1,
    di.aprovacao_recebida1 as a1, di.data_aprovacao_recebida1,
    di."R1", di."R1_date",
    di.maquete_enviada2 as m2, di.data_maquete_enviada2,
    di.aprovacao_recebida2 as a2, di.data_aprovacao_recebida2,
    di."R2", di."R2_date",
    di.maquete_enviada3 as m3, di.data_maquete_enviada3,
    di.aprovacao_recebida3 as a3, di.data_aprovacao_recebida3,
    di."R3", di."R3_date",
    di.maquete_enviada4 as m4, di.data_maquete_enviada4,
    di.aprovacao_recebida4 as a4, di.data_aprovacao_recebida4,
    di."R4", di."R4_date",
    di.maquete_enviada5 as m5, di.data_maquete_enviada5,
    di.aprovacao_recebida5 as a5, di.data_aprovacao_recebida5,
    di."R5", di."R5_date",
    di.maquete_enviada6 as m6, di.data_maquete_enviada6,
    di.aprovacao_recebida6 as a6, di.data_aprovacao_recebida6,
    di."R6", di."R6_date",
    di.paginacao, di.data_paginacao,
    le.id as logistics_id,
    le.saiu as delivered,
    le.guia,
    t.name as transportadora,
    a.nome_arm as local_entrega,
    le.quantidade as qty_delivered,
    le.data_saida,
    CASE
      WHEN le.saiu = true THEN (le.data_saida - fo.created_at::date)::integer
      ELSE (CURRENT_DATE - fo.created_at::date)::integer
    END as days_in_production
  FROM folhas_obras fo
  JOIN items_base ib ON ib.folha_obra_id = fo.id
  LEFT JOIN designer_items di ON di.item_id = ib.id
  LEFT JOIN profiles p ON p.user_id = di.designer::uuid
  LEFT JOIN logistica_entregas le ON le.item_id = ib.id
  LEFT JOIN transportadora t ON t.id = le.transportadora::uuid
  LEFT JOIN armazens a ON a.id = le.id_local_entrega
  WHERE fo.id = fo_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION status_hunter_search_fo(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_search_orc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_search_cliente(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_search_campanha(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_search_item(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_search_guia(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION status_hunter_full_status(UUID) TO authenticated;
