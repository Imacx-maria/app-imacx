import type { Job, Item } from "../types";

export const fetchJobs = async (
  supabase: any,
  foFilter: string,
  orcFilter: string,
  campaignFilter: string,
  itemFilter: string,
  codigoFilter: string,
): Promise<Job[]> => {
  try {
    let jobIds: string[] | null = null;

    const hasItemFilters = !!(itemFilter?.trim() || codigoFilter?.trim());

    if (hasItemFilters) {
      let itemQuery = supabase.from("items_base").select("folha_obra_id");

      if (itemFilter?.trim()) {
        itemQuery = itemQuery.ilike("descricao", `%${itemFilter.trim()}%`);
      }
      if (codigoFilter?.trim()) {
        itemQuery = itemQuery.ilike("codigo", `%${codigoFilter.trim()}%`);
      }

      const { data: itemData, error: itemError } = await itemQuery;

      if (itemError) {
        console.error("Error searching items:", itemError);
        return [];
      }

      if (itemData && itemData.length > 0) {
        jobIds = Array.from(
          new Set(itemData.map((item: any) => item.folha_obra_id)),
        );
      } else {
        return [];
      }
    }

    let query = supabase
      .from("folhas_obras")
      .select(
        "id, created_at, Numero_do_, numero_orc, Trabalho, Data_efeti, prioridade, Nome, customer_id",
      )
      .not("Numero_do_", "is", null)
      .not("numero_orc", "is", null);

    const hasActiveFilters =
      foFilter?.trim() ||
      orcFilter?.trim() ||
      campaignFilter?.trim() ||
      hasItemFilters;

    if (!hasActiveFilters) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      query = query.gte("created_at", twelveMonthsAgo.toISOString());
    }

    if (jobIds) {
      query = query.in("id", jobIds);
    }

    if (foFilter?.trim()) {
      query = query.ilike("Numero_do_", `%${foFilter.trim()}%`);
    }

    if (orcFilter?.trim()) {
      query = query.ilike("numero_orc", `%${orcFilter.trim()}%`);
    }

    if (campaignFilter?.trim()) {
      query = query.ilike("Trabalho", `%${campaignFilter.trim()}%`);
    }

    let { data: jobsData, error: jobsError } = await query.order("created_at", {
      ascending: false,
    });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return [];
    }

    if (!Array.isArray(jobsData)) {
      return [];
    }

    const mappedJobs = jobsData.map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      numero_fo: row.Numero_do_ ? String(row.Numero_do_) : "",
      numero_orc: row.numero_orc ?? null,
      nome_campanha: row.Trabalho || "",
      data_saida: row.Data_efeti ?? null,
      prioridade: row.prioridade ?? false,
      cliente: row.Nome || "",
      id_cliente: row.customer_id ? row.customer_id.toString() : null,
      customer_id: row.customer_id || null,
    }));

    try {
      const jobIdsToCheck = mappedJobs.map((job) => job.id);

      if (jobIdsToCheck.length > 0) {
        const { data: itemsData } = await supabase
          .from("items_base")
          .select("id")
          .in("folha_obra_id", jobIdsToCheck);

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((i: any) => i.id);

          const { data: logisticaItems } = await supabase
            .from("logistica_entregas")
            .select("item_id")
            .eq("concluido", true)
            .in("item_id", itemIds);

          if (logisticaItems && logisticaItems.length > 0) {
            const itemIdsWithConcluido = logisticaItems.map(
              (l: any) => l.item_id,
            );

            const { data: designerItemsToUpdate } = await supabase
              .from("designer_items")
              .select("id, item_id, paginacao, data_paginacao")
              .in("item_id", itemIdsWithConcluido)
              .eq("paginacao", false);

            if (designerItemsToUpdate && designerItemsToUpdate.length > 0) {
              const today = new Date().toISOString().split("T")[0];
              const updates = designerItemsToUpdate.map((item: any) =>
                supabase
                  .from("designer_items")
                  .update({
                    paginacao: true,
                    path_trabalho: "Indefinido",
                    data_paginacao: item.data_paginacao || today,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", item.id),
              );
              await Promise.all(updates);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error auto-updating paginacao from logistica:", error);
    }

    // Fetch designer items for tab count computation (client-side filtering)
    const jobIdsToCheck = mappedJobs.map((job) => job.id);

    if (jobIdsToCheck.length > 0) {
      const { data: designerItems, error: designerError } = await supabase
        .from("designer_items")
        .select(
          `
          id,
          item_id,
          paginacao,
          items_base!inner (id, folha_obra_id)
        `,
        )
        .in("items_base.folha_obra_id", jobIdsToCheck);

      // Attach designer items info to jobs for client-side tab filtering
      if (!designerError && Array.isArray(designerItems)) {
        const itemsByJob: Record<string, any[]> = {};

        designerItems.forEach((item: any) => {
          const base = Array.isArray(item.items_base)
            ? item.items_base[0]
            : item.items_base;
          const jobId = base?.folha_obra_id;

          if (jobId && item.id && base?.id) {
            if (!itemsByJob[jobId]) itemsByJob[jobId] = [];
            itemsByJob[jobId].push(item);
          }
        });

        // Return jobs with designer info attached for client-side filtering
        return mappedJobs.map((job: Job) => ({
          ...job,
          designerItems: itemsByJob[job.id] || [],
        }));
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Error in fetchJobs:", error);
    return [];
  }
};

export const fetchItems = async (
  supabase: any,
  jobIds: string[],
): Promise<Item[]> => {
  if (jobIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("designer_items")
      .select(
        `
        id,
        item_id,
        em_curso,
        duvidas,
        maquete_enviada1,
        aprovacao_recebida1,
        maquete_enviada2,
        aprovacao_recebida2,
        maquete_enviada3,
        aprovacao_recebida3,
        maquete_enviada4,
        aprovacao_recebida4,
        maquete_enviada5,
        aprovacao_recebida5,
        maquete_enviada6,
        aprovacao_recebida6,
        paginacao,
        complexidade,
        notas,
        R1,
        R2,
        R3,
        R4,
        R5,
        R6,
        data_em_curso,
        data_duvidas,
        data_maquete_enviada1,
        data_aprovacao_recebida1,
        data_maquete_enviada2,
        data_aprovacao_recebida2,
        data_maquete_enviada3,
        data_aprovacao_recebida3,
        data_maquete_enviada4,
        data_aprovacao_recebida4,
        data_maquete_enviada5,
        data_aprovacao_recebida5,
        data_maquete_enviada6,
        data_aprovacao_recebida6,
        data_paginacao,
        data_saida,
        data_in,
        R1_date,
        R2_date,
        R3_date,
        R4_date,
        R5_date,
        R6_date,
        path_trabalho,
        updated_at,
        items_base!inner (
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade
        )
      `,
      )
      .in("items_base.folha_obra_id", jobIds)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error);
      return [];
    }

    if (!Array.isArray(data)) return [];

    return data
      .map((d: any) => {
        const base = Array.isArray(d.items_base)
          ? d.items_base[0]
          : d.items_base;

        if (!base || !base.id || !base.folha_obra_id) return null;

        return {
          designer_item_id: d.id,
          id: base.id,
          folha_obra_id: base.folha_obra_id,
          descricao: base.descricao ?? "",
          codigo: base.codigo ?? null,
          quantidade: base.quantidade ?? null,
          em_curso: d.em_curso,
          duvidas: d.duvidas,
          maquete_enviada1: d.maquete_enviada1,
          aprovacao_recebida1: d.aprovacao_recebida1,
          maquete_enviada2: d.maquete_enviada2,
          aprovacao_recebida2: d.aprovacao_recebida2,
          maquete_enviada3: d.maquete_enviada3,
          aprovacao_recebida3: d.aprovacao_recebida3,
          maquete_enviada4: d.maquete_enviada4,
          aprovacao_recebida4: d.aprovacao_recebida4,
          maquete_enviada5: d.maquete_enviada5,
          aprovacao_recebida5: d.aprovacao_recebida5,
          maquete_enviada6: d.maquete_enviada6,
          aprovacao_recebida6: d.aprovacao_recebida6,
          paginacao: d.paginacao,
          complexidade: d.complexidade ?? null,
          notas: d.notas ?? null,
          r1: d.R1,
          r2: d.R2,
          r3: d.R3,
          r4: d.R4,
          r5: d.R5,
          r6: d.R6,
          data_em_curso: d.data_em_curso,
          data_duvidas: d.data_duvidas,
          data_maquete_enviada1: d.data_maquete_enviada1,
          data_aprovacao_recebida1: d.data_aprovacao_recebida1,
          data_maquete_enviada2: d.data_maquete_enviada2,
          data_aprovacao_recebida2: d.data_aprovacao_recebida2,
          data_maquete_enviada3: d.data_maquete_enviada3,
          data_aprovacao_recebida3: d.data_aprovacao_recebida3,
          data_maquete_enviada4: d.data_maquete_enviada4,
          data_aprovacao_recebida4: d.data_aprovacao_recebida4,
          data_maquete_enviada5: d.data_maquete_enviada5,
          data_aprovacao_recebida5: d.data_aprovacao_recebida5,
          data_maquete_enviada6: d.data_maquete_enviada6,
          data_aprovacao_recebida6: d.data_aprovacao_recebida6,
          data_paginacao: d.data_paginacao,
          data_saida: d.data_saida,
          data_in: d.data_in,
          R1_date: d.R1_date,
          R2_date: d.R2_date,
          R3_date: d.R3_date,
          R4_date: d.R4_date,
          R5_date: d.R5_date,
          R6_date: d.R6_date,
          path_trabalho: d.path_trabalho,
          updated_at: d.updated_at,
        } as Item;
      })
      .filter(Boolean) as Item[];
  } catch (error) {
    console.error("Error in fetchItems:", error);
    return [];
  }
};
