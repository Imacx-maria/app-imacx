import { SupabaseClient } from '@supabase/supabase-js';
import type {
  SearchType,
  Match,
  FullStatus,
  ItemStatus,
  DesignerStatus,
  LogisticsEntry,
  RawFOSearchRow,
  RawItemSearchRow,
  RawGuiaSearchRow,
  RawFullStatusRow,
} from './types';

// Sanitize ILIKE input to prevent SQL injection
function sanitizeILikeInput(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Compute designer stage from raw data (Portuguese)
function computeDesignerStage(row: RawFullStatusRow): string {
  if (!row.designer) return "Sem designer atribuido";

  // Check from highest step (6) to lowest (1)
  for (let i = 6; i >= 1; i--) {
    const paginacao = row.paginacao;
    const aprovacao = row[`a${i}` as keyof RawFullStatusRow] as boolean | null;
    const recusado = row[`R${i}` as keyof RawFullStatusRow] as boolean | null;
    const maquete = row[`m${i}` as keyof RawFullStatusRow] as boolean | null;
    const nextMaquete = i < 6 ? row[`m${i + 1}` as keyof RawFullStatusRow] as boolean | null : null;

    if (paginacao && aprovacao) {
      return `Aprovado e paginado (A${i})`;
    }
    if (aprovacao) {
      return `Aprovacao recebida (A${i}), aguarda paginacao`;
    }
    if (recusado) {
      if (nextMaquete) {
        return `Recusado (R${i}), M${i + 1} enviada`;
      }
      return `Recusado (R${i}), aguarda nova maquete`;
    }
    if (maquete) {
      return `Maquete ${i} enviada, aguarda aprovacao`;
    }
  }

  return "Em preparacao de maquete";
}

// Build designer steps record
function buildDesignerSteps(row: RawFullStatusRow): Record<string, string | null> {
  const steps: Record<string, string | null> = {};

  for (let i = 1; i <= 6; i++) {
    steps[`m${i}`] = row[`data_maquete_enviada${i}` as keyof RawFullStatusRow] as string | null;
    steps[`a${i}`] = row[`data_aprovacao_recebida${i}` as keyof RawFullStatusRow] as string | null;
    steps[`r${i}`] = row[`R${i}_date` as keyof RawFullStatusRow] as string | null;
  }

  return steps;
}

// Search by FO Number
export async function searchByFO(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_fo', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] FO search error:', error);
    throw new Error('Erro ao pesquisar Folha de Obra');
  }

  return (data as RawFOSearchRow[] || []).map((row) => ({
    type: 'FO',
    id: row.id,
    label: `FO ${row.fo_number}`,
    metadata: {
      fo_number: row.fo_number,
      orc_number: row.numero_orc || undefined,
      cliente: row.cliente || undefined,
      campanha: row.campanha || undefined,
      total_items: row.total_items || undefined,
    },
  }));
}

// Search by ORC Number
export async function searchByORC(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_orc', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] ORC search error:', error);
    throw new Error('Erro ao pesquisar Orcamento');
  }

  return (data as RawFOSearchRow[] || []).map((row) => ({
    type: 'ORC',
    id: row.id,
    label: `ORC ${row.numero_orc}`,
    metadata: {
      fo_number: row.fo_number,
      orc_number: row.numero_orc || undefined,
      cliente: row.cliente || undefined,
      campanha: row.campanha || undefined,
    },
  }));
}

// Search by Cliente
export async function searchByCliente(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_cliente', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] Cliente search error:', error);
    throw new Error('Erro ao pesquisar Cliente');
  }

  return (data as RawFOSearchRow[] || []).map((row) => ({
    type: 'CLIENTE',
    id: row.id,
    label: row.cliente || 'Cliente desconhecido',
    metadata: {
      fo_number: row.fo_number,
      cliente: row.cliente || undefined,
      campanha: row.campanha || undefined,
    },
  }));
}

// Search by Campanha
export async function searchByCampanha(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_campanha', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] Campanha search error:', error);
    throw new Error('Erro ao pesquisar Campanha');
  }

  return (data as RawFOSearchRow[] || []).map((row) => ({
    type: 'CAMPANHA',
    id: row.id,
    label: row.campanha || 'Campanha desconhecida',
    metadata: {
      fo_number: row.fo_number,
      cliente: row.cliente || undefined,
      campanha: row.campanha || undefined,
    },
  }));
}

// Search by Item
export async function searchByItem(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_item', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] Item search error:', error);
    throw new Error('Erro ao pesquisar Item');
  }

  return (data as RawItemSearchRow[] || []).map((row) => ({
    type: 'ITEM',
    id: row.id,
    label: row.descricao || row.codigo || 'Item desconhecido',
    metadata: {
      fo_number: row.fo_number || undefined,
      cliente: row.cliente || undefined,
    },
  }));
}

// Search by Guia
export async function searchByGuia(
  supabase: SupabaseClient,
  value: string
): Promise<Match[]> {
  const sanitized = sanitizeILikeInput(value);

  const { data, error } = await supabase.rpc('status_hunter_search_guia', {
    search_value: `%${sanitized}%`
  });

  if (error) {
    console.error('[Status Hunter] Guia search error:', error);
    throw new Error('Erro ao pesquisar Guia');
  }

  return (data as RawGuiaSearchRow[] || []).map((row) => ({
    type: 'GUIA',
    id: row.id,
    label: `Guia ${row.guia}`,
    metadata: {
      fo_number: row.fo_number || undefined,
      cliente: row.cliente || undefined,
    },
  }));
}

// Get full status for a single FO
export async function getFullStatus(
  supabase: SupabaseClient,
  foId: string
): Promise<FullStatus | null> {
  const { data, error } = await supabase.rpc('status_hunter_full_status', {
    fo_id: foId
  });

  if (error) {
    console.error('[Status Hunter] Full status error:', error);
    throw new Error('Erro ao obter estado completo');
  }

  const rows = data as RawFullStatusRow[];
  if (!rows || rows.length === 0) {
    return null;
  }

  // First row contains FO info
  const firstRow = rows[0];

  // Group by item_id
  const itemsMap = new Map<string, { row: RawFullStatusRow; logistics: RawFullStatusRow[] }>();

  for (const row of rows) {
    const existing = itemsMap.get(row.item_id);
    if (!existing) {
      itemsMap.set(row.item_id, { row, logistics: row.logistics_id ? [row] : [] });
    } else if (row.logistics_id) {
      // Check if this logistics entry already exists
      const logisticsExists = existing.logistics.some(l => l.logistics_id === row.logistics_id);
      if (!logisticsExists) {
        existing.logistics.push(row);
      }
    }
  }

  // Build items array
  const items: ItemStatus[] = [];

  for (const [itemId, { row, logistics }] of itemsMap) {
    const designerStatus: DesignerStatus = {
      name: row.designer,
      stage: computeDesignerStage(row),
      steps: buildDesignerSteps(row),
      paginacao: row.paginacao || false,
      paginacao_date: row.data_paginacao,
    };

    const logisticsEntries: LogisticsEntry[] = logistics.map((l) => ({
      id: l.logistics_id!,
      delivered: l.delivered || false,
      guia: l.guia,
      transportadora: l.transportadora,
      local_entrega: l.local_entrega,
      qty_delivered: l.qty_delivered,
      data_saida: l.data_saida,
      days_in_production: l.days_in_production || 0,
    }));

    items.push({
      id: itemId,
      descricao: row.item || 'Sem descricao',
      quantidade: row.qty || 0,
      designer: designerStatus,
      logistics: logisticsEntries,
    });
  }

  return {
    fo: {
      id: foId,
      fo_number: firstRow.fo_number,
      orc_number: firstRow.orc_number || '',
      cliente: firstRow.cliente || '',
      campanha: firstRow.campanha || '',
      created_at: firstRow.fo_created || '',
    },
    items,
  };
}

// Main search dispatcher
export async function executeSearch(
  supabase: SupabaseClient,
  type: SearchType,
  value: string
): Promise<Match[]> {
  switch (type) {
    case 'FO':
      return searchByFO(supabase, value);
    case 'ORC':
      return searchByORC(supabase, value);
    case 'CLIENTE':
      return searchByCliente(supabase, value);
    case 'CAMPANHA':
      return searchByCampanha(supabase, value);
    case 'ITEM':
      return searchByItem(supabase, value);
    case 'GUIA':
      return searchByGuia(supabase, value);
    default:
      throw new Error(`Tipo de pesquisa desconhecido: ${type}`);
  }
}
