/**
 * Custom hook for managing paletes UI and form state
 * Consolidates paletes-related UI and form useState hooks
 */

import { useState, useCallback } from 'react';

export interface PaletesUIState {
  // UI states
  editingPaleteId: string | null;
  showNewPaleteRow: boolean;

  // Form data
  newPaleteData: {
    no_palete: string;
    fornecedor_id: string;
    no_guia_forn: string;
    ref_cartao: string;
    qt_palete: string;
    data: string;
    author_id: string;
  };

  editingPaleteData: {
    [key: string]: any;
  };

  // Submission state
  isSubmitting: boolean;
}

const INITIAL_PALETE_FORM = {
  no_palete: '',
  fornecedor_id: '',
  no_guia_forn: '',
  ref_cartao: '',
  qt_palete: '',
  data: new Date().toISOString().split('T')[0],
  author_id: '',
};

const INITIAL_STATE: PaletesUIState = {
  editingPaleteId: null,
  showNewPaleteRow: false,
  newPaleteData: INITIAL_PALETE_FORM,
  editingPaleteData: {},
  isSubmitting: false,
};

export function usePaletesUI() {
  const [state, setState] = useState<PaletesUIState>(INITIAL_STATE);

  const setEditingPaleteId = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      editingPaleteId: id,
    }));
  }, []);

  const setShowNewPaleteRow = useCallback((show: boolean) => {
    setState((prev) => ({
      ...prev,
      showNewPaleteRow: show,
      newPaleteData: show ? INITIAL_PALETE_FORM : prev.newPaleteData,
    }));
  }, []);

  const setNewPaleteData = useCallback((data: any) => {
    setState((prev) => ({
      ...prev,
      newPaleteData: data,
    }));
  }, []);

  const updateNewPaleteField = useCallback((field: string, value: any) => {
    setState((prev) => ({
      ...prev,
      newPaleteData: {
        ...prev.newPaleteData,
        [field]: value,
      },
    }));
  }, []);

  const setEditingPaleteData = useCallback((data: any) => {
    setState((prev) => ({
      ...prev,
      editingPaleteData: data,
    }));
  }, []);

  const updateEditingPaleteField = useCallback((rowId: string, field: string, value: any) => {
    setState((prev) => ({
      ...prev,
      editingPaleteData: {
        ...prev.editingPaleteData,
        [rowId]: {
          ...prev.editingPaleteData[rowId],
          [field]: value,
        },
      },
    }));
  }, []);

  const setIsSubmitting = useCallback((submitting: boolean) => {
    setState((prev) => ({
      ...prev,
      isSubmitting: submitting,
    }));
  }, []);

  const resetPaleteUI = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    setEditingPaleteId,
    setShowNewPaleteRow,
    setNewPaleteData,
    updateNewPaleteField,
    setEditingPaleteData,
    updateEditingPaleteField,
    setIsSubmitting,
    resetPaleteUI,
  };
}
