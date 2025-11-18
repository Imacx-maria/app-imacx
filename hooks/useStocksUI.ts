/**
 * Custom hook for managing stocks UI, sorting, and editing state
 * Consolidates multiple useState hooks for stocks-related UI
 */

import { useState, useCallback } from 'react';

export interface StocksUIState {
  // Sorting
  sortColumnEntries: string;
  sortDirectionEntries: 'asc' | 'desc';
  sortColumnCurrent: string;
  sortDirectionCurrent: 'asc' | 'desc';

  // Editing
  editingMaterial: string | null;
  editingStockCorrectId: string | null;

  // Value maps for inline editing
  stockCorrectValue: string;
  stockCorrectValueMap: { [id: string]: string };
  stockMinimoValueMap: { [id: string]: string };
  stockCriticoValueMap: { [id: string]: string };
}

const INITIAL_STATE: StocksUIState = {
  sortColumnEntries: 'data',
  sortDirectionEntries: 'desc',
  sortColumnCurrent: 'material',
  sortDirectionCurrent: 'asc',
  editingMaterial: null,
  editingStockCorrectId: null,
  stockCorrectValue: '',
  stockCorrectValueMap: {},
  stockMinimoValueMap: {},
  stockCriticoValueMap: {},
};

export function useStocksUI() {
  const [state, setState] = useState<StocksUIState>(INITIAL_STATE);

  const setSortEntries = useCallback((column: string, direction: 'asc' | 'desc') => {
    setState((prev) => ({
      ...prev,
      sortColumnEntries: column,
      sortDirectionEntries: direction,
    }));
  }, []);

  const setSortCurrent = useCallback((column: string, direction: 'asc' | 'desc') => {
    setState((prev) => ({
      ...prev,
      sortColumnCurrent: column,
      sortDirectionCurrent: direction,
    }));
  }, []);

  const setEditingMaterial = useCallback((materialId: string | null) => {
    setState((prev) => ({
      ...prev,
      editingMaterial: materialId,
    }));
  }, []);

  const setEditingStockCorrectId = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      editingStockCorrectId: id,
    }));
  }, []);

  const setStockCorrectValue = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      stockCorrectValue: value,
    }));
  }, []);

  const updateStockCorrectValueMap = useCallback((id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      stockCorrectValueMap: {
        ...prev.stockCorrectValueMap,
        [id]: value,
      },
    }));
  }, []);

  const updateStockMinimoValueMap = useCallback((id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      stockMinimoValueMap: {
        ...prev.stockMinimoValueMap,
        [id]: value,
      },
    }));
  }, []);

  const updateStockCriticoValueMap = useCallback((id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      stockCriticoValueMap: {
        ...prev.stockCriticoValueMap,
        [id]: value,
      },
    }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    setSortEntries,
    setSortCurrent,
    setEditingMaterial,
    setEditingStockCorrectId,
    setStockCorrectValue,
    updateStockCorrectValueMap,
    updateStockMinimoValueMap,
    updateStockCriticoValueMap,
    reset,
  };
}
