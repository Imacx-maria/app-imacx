import OperacoesClient, {
  ProductionItem,
} from "@/components/producao/OperacoesClient";
import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";

export const revalidate = 0; // Keep data fresh

/**
 * Server-side data fetching for Production Operations page
 * This runs on the server before sending HTML to the client, eliminating
 * the waterfall of client-side fetches that were causing slow LCP.
 */
async function getInitialData() {
  const supabase = await createServerClient(cookies());

  try {
    // Fetch items with relations - same query as client but runs on server
    const { data: itemsData, error: itemsError } = await supabase
      .from("items_base")
      .select(
        `
        id,
        folha_obra_id,
        descricao,
        codigo,
        quantidade,
        concluido,
        concluido_maq,
        brindes,
        prioridade,
        complexidade,
        created_at,
        folhas_obras!inner (
          Numero_do_,
          numero_orc,
          Trabalho,
          prioridade
        ),
        designer_items (
          paginacao,
          path_trabalho
        ),
        logistica_entregas (
          concluido
        )
      `,
      )
      .or("concluido.is.null,concluido.eq.false");

    if (itemsError) {
      console.error("Server: items_base query failed:", itemsError);
      return { items: [], error: itemsError.message };
    }

    if (!itemsData || itemsData.length === 0) {
      return { items: [], error: null };
    }

    // Transform the data (same logic as client)
    const transformedItems = itemsData.map((item) => {
      const transformedItem = {
        ...item,
        folhas_obras: Array.isArray(item.folhas_obras)
          ? item.folhas_obras[0]
          : item.folhas_obras,
        designer_items: Array.isArray(item.designer_items)
          ? item.designer_items[0]
          : item.designer_items,
        logistica_entregas: Array.isArray(item.logistica_entregas)
          ? item.logistica_entregas
          : item.logistica_entregas,
      };

      if (transformedItem.folhas_obras) {
        const foData: any = transformedItem.folhas_obras;
        const mappedFo: any = {
          numero_orc: foData.numero_orc,
          prioridade: foData.prioridade,
        };
        if (foData.Numero_do_ !== undefined) {
          mappedFo.numero_fo = String(foData.Numero_do_);
        }
        if (foData.Trabalho !== undefined) {
          mappedFo.nome_campanha = foData.Trabalho;
        }
        transformedItem.folhas_obras = mappedFo;
      }

      return transformedItem;
    });

    // Filter items that meet all conditions
    const filteredItems = transformedItems.filter((item) => {
      let hasLogisticaEntregasNotConcluida = false;

      if (item.logistica_entregas) {
        if (Array.isArray(item.logistica_entregas)) {
          hasLogisticaEntregasNotConcluida = (
            item.logistica_entregas as any[]
          ).some((entrega: any) => entrega.concluido === false);
        } else {
          hasLogisticaEntregasNotConcluida =
            (item.logistica_entregas as any).concluido === false;
        }
      }

      const hasPaginacaoTrue = item.designer_items?.paginacao === true;
      const isNotBrinde = item.brindes !== true;
      const isNotOffset = item.complexidade !== "OFFSET";
      const isNotConcluido = item.concluido !== true;

      const foData = item.folhas_obras as any;
      const hasFoValue =
        foData?.numero_fo &&
        foData?.numero_fo !== "0" &&
        foData?.numero_fo !== "0000";
      const hasOrcValue = foData?.numero_orc && foData?.numero_orc !== 0;

      return (
        hasLogisticaEntregasNotConcluida &&
        hasPaginacaoTrue &&
        isNotBrinde &&
        isNotOffset &&
        isNotConcluido &&
        hasFoValue &&
        hasOrcValue
      );
    });

    // Get item IDs for batch operations query
    const itemIds = filteredItems.map((item) => item.id);

    if (itemIds.length === 0) {
      return { items: [], error: null };
    }

    // BATCH QUERY: Get all operations in ONE query (the key optimization!)
    const { data: allOperations, error: opError } = await supabase
      .from("producao_operacoes")
      .select("item_id, concluido, Tipo_Op")
      .in("item_id", itemIds);

    if (opError) {
      console.error("Server: operations query failed:", opError);
    }

    // Group operations by item_id for fast lookup
    const operationsByItem = new Map<string, any[]>();
    if (allOperations) {
      for (const op of allOperations) {
        if (!operationsByItem.has(op.item_id)) {
          operationsByItem.set(op.item_id, []);
        }
        operationsByItem.get(op.item_id)!.push(op);
      }
    }

    // Process items - exclude completed ones
    const itemsWithoutCompleted: ProductionItem[] = [];
    for (const item of filteredItems) {
      const itemOps = operationsByItem.get(item.id) || [];
      const corteOps = itemOps.filter((op: any) => op.Tipo_Op === "Corte");

      const hasAnyCorte = corteOps.length > 0;
      const allCorteConcluded =
        hasAnyCorte && corteOps.every((op: any) => op.concluido === true);

      // Only exclude when ALL corte operations are concluded
      if (!allCorteConcluded) {
        itemsWithoutCompleted.push({
          ...item,
          _operationsAllConcluded: allCorteConcluded,
          _hasOperations: itemOps.length > 0,
        } as ProductionItem);
      }
    }

    return { items: itemsWithoutCompleted, error: null };
  } catch (error: any) {
    console.error("Server: unexpected error:", error);
    return { items: [], error: error.message || "Unknown error" };
  }
}

export default async function OperacoesPage() {
  const { items, error } = await getInitialData();

  return <OperacoesClient initialItems={items} initialError={error} />;
}
