/**
 * Custom hook for managing stocks page filter state
 * Consolidates multiple filter useState hooks into a single state object
 * Reduces state management complexity significantly
 */

import { useState, useCallback } from 'react';

export interface StocksFiltersState {
  // Stocks entry filters
  materialFilter: string;
  referenciaFilter: string;

  // Current stocks filters
  currentStockFilter: string;
  currentStockReferenciaFilter: string;

  // Effective/applied filters (debounced)
  effectiveMaterialFilter: string;
  effectiveReferenciaFilter: string;
  effectiveCurrentStockFilter: string;
  effectiveCurrentStockReferenciaFilter: string;
}

export interface PaletesFiltersState {
  // Paletes filters
  search: string;
  referencia: string;
  dateFrom: string;
  dateTo: string;
  fornecedor: string;
  author: string;
}

export interface SortingState {
  // Stocks sorting
  sortColumnEntries: string;
  sortDirectionEntries: 'asc' | 'desc';
  sortColumnCurrent: string;
  sortDirectionCurrent: 'asc' | 'desc';

  // Paletes sorting
  sortColumnPaletes: string;
  sortDirectionPaletes: 'asc' | 'desc';
}

export interface LoadingState {
  stocks: boolean;
  currentStocks: boolean;
  paletes: boolean;
}

const INITIAL_STOCKS_FILTERS: StocksFiltersState = {
  materialFilter: '',
  referenciaFilter: '',
  currentStockFilter: '',
  currentStockReferenciaFilter: '',
  effectiveMaterialFilter: '',
  effectiveReferenciaFilter: '',
  effectiveCurrentStockFilter: '',
  effectiveCurrentStockReferenciaFilter: '',
};

const INITIAL_PALETES_FILTERS: PaletesFiltersState = {
  search: '',
  referencia: '',
  dateFrom: '',
  dateTo: '',
  fornecedor: '__all__',
  author: '__all__',
};

const INITIAL_SORTING: SortingState = {
  sortColumnEntries: 'data',
  sortDirectionEntries: 'desc',
  sortColumnCurrent: 'material',
  sortDirectionCurrent: 'asc',
  sortColumnPaletes: 'no_palete',
  sortDirectionPaletes: 'asc',
};

const INITIAL_LOADING: LoadingState = {
  stocks: true,
  currentStocks: true,
  paletes: true,
};

export function useStockFilters() {
  const [stocksFilters, setStocksFilters] = useState<StocksFiltersState>(
    INITIAL_STOCKS_FILTERS,
  );

  const updateStocksFilter = useCallback(
    (field: keyof StocksFiltersState, value: string) => {
      setStocksFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const updateStocksFilters = useCallback(
    (updates: Partial<StocksFiltersState>) => {
      setStocksFilters((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [],
  );

  const resetStocksFilters = useCallback(() => {
    setStocksFilters(INITIAL_STOCKS_FILTERS);
  }, []);

  return {
    stocksFilters,
    updateStocksFilter,
    updateStocksFilters,
    resetStocksFilters,
  };
}

export function usePaletesFilters() {
  const [paletesFilters, setPaletesFilters] = useState<PaletesFiltersState>(
    INITIAL_PALETES_FILTERS,
  );

  const updatePaletesFilter = useCallback(
    (field: keyof PaletesFiltersState, value: string) => {
      setPaletesFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const updatePaletesFilters = useCallback(
    (updates: Partial<PaletesFiltersState>) => {
      setPaletesFilters((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [],
  );

  const resetPaletesFilters = useCallback(() => {
    setPaletesFilters(INITIAL_PALETES_FILTERS);
  }, []);

  return {
    paletesFilters,
    updatePaletesFilter,
    updatePaletesFilters,
    resetPaletesFilters,
  };
}

export function useSorting() {
  const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);

  const updateStocksSorting = useCallback(
    (field: 'sortColumnEntries' | 'sortDirectionEntries' | 'sortColumnCurrent' | 'sortDirectionCurrent', value: string) => {
      setSorting((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const updatePaletesSorting = useCallback(
    (field: 'sortColumnPaletes' | 'sortDirectionPaletes', value: string) => {
      setSorting((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const resetSorting = useCallback(() => {
    setSorting(INITIAL_SORTING);
  }, []);

  return {
    sorting,
    updateStocksSorting,
    updatePaletesSorting,
    resetSorting,
  };
}

export function useLoadingStates() {
  const [loadingState, setLoadingState] = useState<LoadingState>(INITIAL_LOADING);

  const setStocksLoading = useCallback((loading: boolean) => {
    setLoadingState((prev) => ({
      ...prev,
      stocks: loading,
    }));
  }, []);

  const setCurrentStocksLoading = useCallback((loading: boolean) => {
    setLoadingState((prev) => ({
      ...prev,
      currentStocks: loading,
    }));
  }, []);

  const setPaletesLoading = useCallback((loading: boolean) => {
    setLoadingState((prev) => ({
      ...prev,
      paletes: loading,
    }));
  }, []);

  return {
    loadingState,
    setStocksLoading,
    setCurrentStocksLoading,
    setPaletesLoading,
  };
}
