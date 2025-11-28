/**
 * useAuditLogs Hook
 * Handles fetching and filtering audit logs with enhanced statistics
 */

import { useState, useCallback, useMemo } from "react";
import { fetchEnhancedAuditLogs } from "@/utils/auditLogging";
import type { AuditLogFilters, AuditLogStats } from "../types";

interface UseAuditLogsOptions {
  supabase: any;
}

interface UseAuditLogsReturn {
  auditLogs: any[];
  filteredLogs: any[];
  enhancedStats: AuditLogStats;
  logsLoading: boolean;
  filters: AuditLogFilters;
  setFilters: (filters: Partial<AuditLogFilters>) => void;
  clearFilters: () => void;
  fetchAuditLogs: () => Promise<void>;
  hasActiveFilters: boolean;
}

const defaultFilters: AuditLogFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  operatorFilter: "",
  opTypeFilter: "",
  actionTypeFilter: "",
  changedByFilter: "",
};

export function useAuditLogs({
  supabase,
}: UseAuditLogsOptions): UseAuditLogsReturn {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filters, setFiltersState] = useState<AuditLogFilters>(defaultFilters);

  const fetchAuditLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const enhancedLogs = await fetchEnhancedAuditLogs(supabase);
      setAuditLogs(enhancedLogs);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLogsLoading(false);
    }
  }, [supabase]);

  const setFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.dateFrom ||
      filters.dateTo ||
      filters.operatorFilter ||
      filters.opTypeFilter ||
      filters.actionTypeFilter ||
      filters.changedByFilter
    );
  }, [filters]);

  const { filteredLogs, enhancedStats } = useMemo(() => {
    let filtered = [...auditLogs];

    // Apply filters
    if (filters.dateFrom) {
      filtered = filtered.filter(
        (log) =>
          log.changed_at && new Date(log.changed_at) >= filters.dateFrom!
      );
    }
    if (filters.dateTo) {
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (log) => log.changed_at && new Date(log.changed_at) <= endOfDay
      );
    }
    if (filters.operatorFilter) {
      filtered = filtered.filter(
        (log) =>
          log.operador_antigo_nome?.includes(filters.operatorFilter) ||
          log.operador_novo_nome?.includes(filters.operatorFilter)
      );
    }
    if (filters.opTypeFilter) {
      filtered = filtered.filter(
        (log) => log.producao_operacoes?.Tipo_Op === filters.opTypeFilter
      );
    }
    if (filters.actionTypeFilter) {
      filtered = filtered.filter(
        (log) => log.action_type === filters.actionTypeFilter
      );
    }
    if (filters.changedByFilter) {
      filtered = filtered.filter((log) => {
        const changedBy = log.profiles
          ? `${log.profiles.first_name} ${log.profiles.last_name}`
          : "Sistema";
        return changedBy.includes(filters.changedByFilter);
      });
    }

    // Calculate enhanced stats
    const suspicious = filtered.filter((log) => {
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by !== log.producao_operacoes.operador_id;
    }).length;

    const quantityIncreases = filtered.filter((log) => {
      if (log.quantidade_antiga === null || log.quantidade_nova === null)
        return false;
      const increase =
        ((log.quantidade_nova - log.quantidade_antiga) /
          log.quantidade_antiga) *
        100;
      return increase >= 30;
    }).length;

    const selfEdits = filtered.filter((log) => {
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by === log.producao_operacoes.operador_id;
    }).length;

    const otherEdits = filtered.filter((log) => {
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by !== log.producao_operacoes.operador_id;
    }).length;

    return {
      filteredLogs: filtered,
      enhancedStats: {
        total: filtered.length,
        inserts: filtered.filter((log: any) => log.action_type === "INSERT")
          .length,
        updates: filtered.filter((log: any) => log.action_type === "UPDATE")
          .length,
        deletes: filtered.filter((log: any) => log.action_type === "DELETE")
          .length,
        suspicious,
        quantityIncreases,
        selfEdits,
        otherEdits,
      },
    };
  }, [auditLogs, filters]);

  return {
    auditLogs,
    filteredLogs,
    enhancedStats,
    logsLoading,
    filters,
    setFilters,
    clearFilters,
    fetchAuditLogs,
    hasActiveFilters,
  };
}
