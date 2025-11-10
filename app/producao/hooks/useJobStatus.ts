import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  setJobsSaiuStatus: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setJobsCompletionStatus: React.Dispatch<
    React.SetStateAction<Record<string, { completed: boolean; percentage: number }>>
  >,
  setJobTotalValues: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) {
  /**
   * Fetch saiu (shipped) status for jobs
   *
   * Checks if ALL items for each job have saiu=true in logistics entries.
   * A job is considered "saiu" only when every single item has been shipped.
   *
   * @param jobIds - Array of job IDs to check
   */
  const fetchJobsSaiuStatus = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      try {
        // First get all items for these jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('id, folha_obra_id')
          .in('folha_obra_id', jobIds)

        if (itemsError) throw itemsError

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((item) => item.id)

          // Get logistics entries for these items
          const { data: logisticsData, error: logisticsError } = await supabase
            .from('logistica_entregas')
            .select('item_id, saiu')
            .in('item_id', itemIds)

          if (logisticsError) throw logisticsError

          // Calculate saiu status for each job
          const jobSaiuStatus: Record<string, boolean> = {}

          jobIds.forEach((jobId) => {
            const jobItems = itemsData.filter(
              (item) => item.folha_obra_id === jobId,
            )

            if (jobItems.length === 0) {
              jobSaiuStatus[jobId] = false
              return
            }

            // Check if all items have logistics entries with saiu=true
            const allItemsSaiu = jobItems.every((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              )
              return logisticsEntry && logisticsEntry.saiu === true
            })

            jobSaiuStatus[jobId] = allItemsSaiu
          })

          setJobsSaiuStatus(jobSaiuStatus)
        }
      } catch (error) {
        console.error('Error fetching jobs saiu status:', error)
      }
    },
    [supabase, setJobsSaiuStatus],
  )

  /**
   * Fetch completion status for jobs
   *
   * Calculates the percentage of items completed for each job based on
   * logistics entries with concluido=true. Also determines if job is fully completed.
   *
   * @param jobIds - Array of job IDs to check
   */
  const fetchJobsCompletionStatus = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      try {
        // First get all items for these jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('id, folha_obra_id')
          .in('folha_obra_id', jobIds)

        if (itemsError) throw itemsError

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((item) => item.id)

          // Get logistics entries for these items
          const { data: logisticsData, error: logisticsError } = await supabase
            .from('logistica_entregas')
            .select('item_id, concluido')
            .in('item_id', itemIds)

          if (logisticsError) throw logisticsError

          // Calculate completion status for each job
          const jobCompletionStatus: Record<
            string,
            { completed: boolean; percentage: number }
          > = {}

          jobIds.forEach((jobId) => {
            const jobItems = itemsData.filter(
              (item) => item.folha_obra_id === jobId,
            )

            if (jobItems.length === 0) {
              jobCompletionStatus[jobId] = { completed: false, percentage: 0 }
              return
            }

            // Calculate completion percentage based on logistics entries with concluido=true
            const completedItems = jobItems.filter((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              )
              return logisticsEntry && logisticsEntry.concluido === true
            })

            const percentage = Math.round(
              (completedItems.length / jobItems.length) * 100,
            )
            const allCompleted = completedItems.length === jobItems.length

            jobCompletionStatus[jobId] = { completed: allCompleted, percentage }
          })

          setJobsCompletionStatus(jobCompletionStatus)
        }
      } catch (error) {
        console.error('Error fetching jobs completion status:', error)
      }
    },
    [supabase, setJobsCompletionStatus],
  )

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
      if (jobIds.length === 0) return

      try {
        // Get all jobs with their FO numbers
        const { data: jobsData, error: jobsError } = await supabase
          .from('folhas_obras')
          .select('id, Numero_do_')
          .in('id', jobIds)
          .not('Numero_do_', 'is', null)

        if (jobsError) throw jobsError

        // Extract FO numbers
        const foNumbers = jobsData
          ?.map((job) => String(job.Numero_do_))
          .filter((fo) => fo && fo !== 'null' && fo !== 'undefined') || []

        if (foNumbers.length === 0) {
          setJobTotalValues({})
          return
        }

        // Fetch values from PHC BO table
        const { data: boData, error: boError } = await supabase
          .schema('phc')
          .from('bo')
          .select('document_number, total_value')
          .eq('document_type', 'Folha de Obra')
          .in('document_number', foNumbers)

        if (boError) throw boError

        // Create a map of FO number -> total_value
        const foValueMap: Record<string, number> = {}
        boData?.forEach((row) => {
          foValueMap[String(row.document_number)] = Number(row.total_value) || 0
        })

        // Create a map of job ID -> total_value by matching FO numbers
        const jobValuesMap: Record<string, number> = {}
        jobsData?.forEach((job) => {
          const foValue = foValueMap[String(job.Numero_do_)] || 0
          jobValuesMap[job.id] = foValue
        })

        setJobTotalValues(jobValuesMap)
      } catch (error) {
        console.error('Error fetching job total values:', error)
      }
    },
    [supabase, setJobTotalValues],
  )

  return {
    fetchJobsSaiuStatus,
    fetchJobsCompletionStatus,
    fetchJobTotalValues,
  }
}
