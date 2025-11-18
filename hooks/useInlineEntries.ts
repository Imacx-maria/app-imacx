/**
 * Custom hook for managing inline stock entries
 * Consolidates inline entry editing and batch operations state
 */

import { useState, useCallback } from 'react';

export interface InlineEntry {
  id: string;
  material_id: string;
  material_name: string;
  referencia: string;
  fornecedor_id: string;
  fornecedor_name: string;
  quantidade: number;
  no_guia_forn: string;
  no_palete: string;
  num_paletes: number;
  size_x: number;
  size_y: number;
  preco_unitario: number;
  valor_total: number;
  isSaving: boolean;
}

export interface InlineEntriesState {
  entries: InlineEntry[];
  isVisible: boolean;
  isSavingBatch: boolean;
  lastSavesSummary: {
    count: number;
    paletes: string[];
    total: number;
  } | null;
}

const INITIAL_STATE: InlineEntriesState = {
  entries: [],
  isVisible: false,
  isSavingBatch: false,
  lastSavesSummary: null,
};

export function useInlineEntries() {
  const [state, setState] = useState<InlineEntriesState>(INITIAL_STATE);

  const setEntries = useCallback((entries: InlineEntry[]) => {
    setState((prev) => ({
      ...prev,
      entries,
    }));
  }, []);

  const addEntry = useCallback((entry: InlineEntry) => {
    setState((prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
    }));
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<InlineEntry>) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    }));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  const setIsVisible = useCallback((visible: boolean) => {
    setState((prev) => ({
      ...prev,
      isVisible: visible,
    }));
  }, []);

  const setIsSavingBatch = useCallback((saving: boolean) => {
    setState((prev) => ({
      ...prev,
      isSavingBatch: saving,
    }));
  }, []);

  const setLastSavesSummary = useCallback(
    (summary: { count: number; paletes: string[]; total: number } | null) => {
      setState((prev) => ({
        ...prev,
        lastSavesSummary: summary,
      }));
    },
    [],
  );

  const clear = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    setEntries,
    addEntry,
    updateEntry,
    removeEntry,
    setIsVisible,
    setIsSavingBatch,
    setLastSavesSummary,
    clear,
  };
}
