import { useState, useMemo, useCallback, useEffect } from 'react';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';

export interface EnvelopeSelectionState {
  selectedIds: Set<string>;
  expectedCash: number;
  selectedCount: number;
}

export function useEnvelopeSelection(availableItems: LisItemForEnvelope[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sincronizar: remover IDs selecionados que não existem mais nos itens disponíveis
  useEffect(() => {
    setSelectedIds(prev => {
      const availableIdSet = new Set(availableItems.map(item => item.id));
      const validIds = new Set<string>();
      
      for (const id of prev) {
        if (availableIdSet.has(id)) {
          validIds.add(id);
        }
      }
      
      // Só atualiza se houve mudança
      if (validIds.size !== prev.size) {
        return validIds;
      }
      return prev;
    });
  }, [availableItems]);

  // Calcular estado da seleção
  const selectionState = useMemo<EnvelopeSelectionState>(() => {
    let expectedCash = 0;
    let selectedCount = 0;

    for (const item of availableItems) {
      if (selectedIds.has(item.id)) {
        expectedCash += item.cash_component || 0;
        selectedCount++;
      }
    }

    return { selectedIds, expectedCash, selectedCount };
  }, [availableItems, selectedIds]);

  // Toggle seleção de um item
  const toggleItem = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Selecionar todos os items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(availableItems.map(item => item.id)));
  }, [availableItems]);

  // Desmarcar todos os items
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Verificar se um item está selecionado
  const isSelected = useCallback((itemId: string) => {
    return selectedIds.has(itemId);
  }, [selectedIds]);

  // Obter items selecionados
  const getSelectedItems = useCallback(() => {
    return availableItems.filter(item => selectedIds.has(item.id));
  }, [availableItems, selectedIds]);

  // Obter IDs selecionados como array
  const getSelectedIds = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  return {
    // Estado
    selectedIds: selectionState.selectedIds,
    expectedCash: selectionState.expectedCash,
    selectedCount: selectionState.selectedCount,
    allSelected: availableItems.length > 0 && selectionState.selectedCount === availableItems.length,
    
    // Ações
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedItems,
    getSelectedIds,
  };
}
