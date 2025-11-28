import { useCallback, useState } from "react";

interface SyncParams {
  effectiveFoF: string;
  effectiveCampF: string;
  effectiveItemF: string;
  effectiveCodeF: string;
  effectiveClientF: string;
  showFatura: boolean;
  activeTab: "em_curso" | "pendentes" | "concluidos";
}

interface UseEtlSyncParams {
  setError: (error: string | null) => void;
  setJobs: (jobs: any[]) => void;
  setAllItems: (items: any[]) => void;
  setJobsSaiuStatus: (status: Record<string, boolean>) => void;
  setCurrentPage: (page: number) => void;
  setHasMoreJobs: (hasMore: boolean) => void;
  fetchJobs: (page: number, reset: boolean, params: Partial<SyncParams>) => Promise<void>;
}

/**
 * Hook for handling ETL sync operations
 * Extracts the sync button handlers from the main page component
 */
export function useEtlSync({
  setError,
  setJobs,
  setAllItems,
  setJobsSaiuStatus,
  setCurrentPage,
  setHasMoreJobs,
  fetchJobs,
}: UseEtlSyncParams) {
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Reset UI state before fetching fresh data
   */
  const resetUiState = useCallback(() => {
    setError(null);
    setJobs([]);
    setAllItems([]);
    setJobsSaiuStatus({});
    setCurrentPage(0);
    setHasMoreJobs(true);
  }, [setError, setJobs, setAllItems, setJobsSaiuStatus, setCurrentPage, setHasMoreJobs]);

  /**
   * Sync contacts (clientes) from PHC
   */
  const syncContacts = useCallback(
    async (syncParams: SyncParams) => {
      setIsSyncing(true);
      try {
        const resp = await fetch("/api/etl/incremental", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "today_clients" }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}) as any);
          console.error("Clients ETL sync failed", body);
          alert(
            "Falhou a sincronização de contactos (ETL). Verifique logs do servidor."
          );
          return;
        }

        // Refresh UI data after successful sync
        resetUiState();
        await fetchJobs(0, true, syncParams);
      } catch (e) {
        console.error("Erro ao executar sincronização de contactos:", e);
        alert("Erro ao executar sincronização de contactos.");
      } finally {
        setIsSyncing(false);
      }
    },
    [resetUiState, fetchJobs]
  );

  /**
   * Sync Folhas de Obra from PHC
   */
  const syncFolhasObra = useCallback(
    async (syncParams: SyncParams) => {
      setIsSyncing(true);
      try {
        const resp = await fetch("/api/etl/incremental", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "today_bo_bi" }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}) as any);
          console.error("ETL incremental sync failed", body);
          alert(
            "Falhou a sincronização incremental (ETL). Verifique logs do servidor."
          );
          return;
        }

        resetUiState();
        await fetchJobs(0, true, syncParams);
      } catch (e) {
        console.error("Erro ao executar sincronização incremental:", e);
        alert("Erro ao executar sincronização incremental.");
      } finally {
        setIsSyncing(false);
      }
    },
    [resetUiState, fetchJobs]
  );

  return {
    isSyncing,
    syncContacts,
    syncFolhasObra,
  };
}
