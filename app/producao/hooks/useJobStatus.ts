import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job Status Hook
 *
 * Manages the fetching and updating of various job status indicators:
 * - Saiu status (whether all items have been shipped)
 * - Completion status (percentage of items completed)
 * - Total values from PHC business system
 *
 * These functions enrich job data with logistics and financial information.
 *
 * @param supabase - Supabase client instance
 * @param setJobsSaiuStatus - State setter for jobs' saiu status
 * @param setJobsCompletionStatus - State setter for jobs' completion status
 * @param setJobTotalValues - State setter for jobs' total values
 * @returns Object with job status fetching functions
 */
export function useJobStatus(
  supabase: SupabaseClient,
  setJobsSaiuStatus: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >,
  setJobsCompletionStatus: React.Dispatch<
    React.SetStateAction<
      Record<string, { completed: boolean; percentage: number }>
    >
  >,
  setJobTotalValues: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
) {
  /**
   * Fetch both saiu and completion status for jobs in a single query
   *
   * CONSOLIDATED: Previously this was two separate functions making duplicate
   * queries to items_base and logistica_entregas. Now fetches once and computes both.
   *
   * - Saiu: Checks if ALL items for each job have saiu=true
   * - Completion: Calculates percentage of items with concluido=true
   *
   * @param jobIds - Array of job IDs to check
   */
  const fetchJobsLogisticsStatus = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return;

      try {
        // Single query for items
        const { data: itemsData, error: itemsError } = await supabase
          .from("items_base")
          .select("id, folha_obra_id")
          .in("folha_obra_id", jobIds);

        if (itemsError) throw itemsError;

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((item) => item.id);

          // Single query for logistics - fetch both saiu AND concluido
          const { data: logisticsData, error: logisticsError } = await supabase
            .from("logistica_entregas")
            .select("item_id, saiu, concluido")
            .in("item_id", itemIds);

          if (logisticsError) throw logisticsError;

          // Calculate BOTH statuses from the same data
          const jobSaiuStatus: Record<string, boolean> = {};
          const jobCompletionStatus: Record<
            string,
            { completed: boolean; percentage: number }
          > = {};

          jobIds.forEach((jobId) => {
            const jobItems = itemsData.filter(
              (item) => item.folha_obra_id === jobId,
            );

            if (jobItems.length === 0) {
              jobSaiuStatus[jobId] = false;
              jobCompletionStatus[jobId] = { completed: false, percentage: 0 };
              return;
            }

            // Calculate saiu status - all items must have saiu=true
            const allItemsSaiu = jobItems.every((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              );
              return logisticsEntry && logisticsEntry.saiu === true;
            });
            jobSaiuStatus[jobId] = allItemsSaiu;

            // Calculate completion percentage
            const completedItems = jobItems.filter((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              );
              return logisticsEntry && logisticsEntry.concluido === true;
            });

            const percentage = Math.round(
              (completedItems.length / jobItems.length) * 100,
            );
            const allCompleted = completedItems.length === jobItems.length;

            jobCompletionStatus[jobId] = {
              completed: allCompleted,
              percentage,
            };
          });

          // Update both states
          setJobsSaiuStatus(jobSaiuStatus);
          setJobsCompletionStatus(jobCompletionStatus);
        }
      } catch (error) {
        console.error("Error fetching jobs logistics status:", error);
      }
    },
    [supabase, setJobsSaiuStatus, setJobsCompletionStatus],
  );

  // Legacy wrappers for backwards compatibility (call consolidated function)
  const fetchJobsSaiuStatus = useCallback(
    async (jobIds: string[]) => fetchJobsLogisticsStatus(jobIds),
    [fetchJobsLogisticsStatus],
  );

  const fetchJobsCompletionStatus = useCallback(async (jobIds: string[]) => {
    // No-op: Already handled by fetchJobsLogisticsStatus
    // Kept for API compatibility if called separately
  }, []);

  /**
   * Fetch total values for jobs from PHC business system
   *
   * Retrieves the financial total_value for each job from the PHC BO (Business Object)
   * table by matching FO (Folha de Obra) numbers. This provides the job's monetary value.
   *
   * @param jobIds - Array of job IDs to fetch values for
   */
  const fetchJobTotalValues = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return;

      try {
        // Get all jobs with their FO numbers and existing PHC values
        const { data: jobsData, error: jobsError } = await supabase
          .from("folhas_obras")
          .select("id, Numero_do_, Euro__tota")
          .in("id", jobIds)
          .not("Numero_do_", "is", null);

        if (jobsError) throw jobsError;

        // Extract FO numbers
        const foNumbers =
          jobsData
            ?.map((job) => String(job.Numero_do_))
            .filter((fo) => fo && fo !== "null" && fo !== "undefined") || [];

        if (foNumbers.length === 0) {
          setJobTotalValues({});
          return;
        }

        // Fetch values from PHC BO table
        const { data: boData, error: boError } = await supabase
          .schema("phc")
          .from("bo")
          .select("document_number, total_value")
          .eq("document_type", "Folha de Obra")
          .in("document_number", foNumbers);

        if (boError) throw boError;

        // Create a map of FO number -> total_value
        const foValueMap: Record<string, number> = {};
        boData?.forEach((row) => {
          foValueMap[String(row.document_number)] =
            Number(row.total_value) || 0;
        });

        // Create a map of job ID -> total_value
        // Priority: Use PHC cache first (always fresh), then Euro__tota only if manually refreshed (> 0)
        const jobValuesMap: Record<string, number> = {};
        jobsData?.forEach((job: any) => {
          const phcCacheValue = foValueMap[String(job.Numero_do_)] || 0;
          const euroTotaValue = job.Euro__tota || 0;
          let finalValue = 0;

          // Prefer PHC cache if available, otherwise use Euro__tota if it was manually refreshed
          if (phcCacheValue > 0) {
            finalValue = phcCacheValue;
          } else if (euroTotaValue > 0) {
            finalValue = euroTotaValue;
          }

          jobValuesMap[job.id] = finalValue;
        });

        // CRITICAL: Merge with existing values instead of replacing the entire state
        // This prevents wiping out values for other jobs when refreshing a single job
        setJobTotalValues((prev) => ({ ...prev, ...jobValuesMap }));
      } catch (error) {
        console.error("Error fetching job total values:", error);
      }
    },
    [supabase, setJobTotalValues],
  );

  return {
    fetchJobsSaiuStatus,
    fetchJobsCompletionStatus,
    fetchJobsLogisticsStatus, // Consolidated function - use this instead of calling both separately
    fetchJobTotalValues,
  };
}
