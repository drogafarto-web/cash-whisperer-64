import { useState, useMemo, useCallback, useEffect } from 'react';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';

export interface EnvelopeSelectionState {
  selectedIds: Set<string>;
  expectedCash: number;
  selectedCount: number;
}

export function useEnvelopeSelection(availableItems: LisItemForEnvelope[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Sincronizar: remover IDs selecionados que não existem mais nos itens disponíveis
  useEffect(() => {
    if (availableItems.length === 0) return;
    
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      
      const availableIdSet = new Set(availableItems.map(item => item.id));
      let hasInvalidId = false;
      
      for (const id of prev) {
        if (!availableIdSet.has(id)) {
          hasInvalidId = true;
          break;
        }
      }
      
      if (!hasInvalidId) return prev;
      
      // Filtrar apenas IDs válidos
      const validIds = new Set<string>();
      for (const id of prev) {
        if (availableIdSet.has(id)) {
          validIds.add(id);
        }
      }
      return validIds;
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

  // Selecionar todos os items que são DINHEIRO
  const selectAll = useCallback(() => {
    const selectableItems = availableItems.filter(
      item => item.payment_method === 'DINHEIRO'
    );
    setSelectedIds(new Set(selectableItems.map(item => item.id)));
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

  // Calcular quantos são selecionáveis (apenas DINHEIRO)
  const selectableCount = useMemo(() => 
    availableItems.filter(item => item.payment_method === 'DINHEIRO').length,
  [availableItems]);

  return {
    // Estado
    selectedIds: selectionState.selectedIds,
    expectedCash: selectionState.expectedCash,
    selectedCount: selectionState.selectedCount,
    selectableCount,
    allSelected: selectableCount > 0 && selectionState.selectedCount === selectableCount,
    
    // Ações
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedItems,
    getSelectedIds,
  };
}
