import { useState, useMemo, useCallback, useEffect } from 'react';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';
import { PaymentMethodType, calculateCardTotals, calculatePixTotal, CardTotals } from '@/services/paymentResolutionService';

export interface PaymentSelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  totalAmount: number;
  cardTotals?: CardTotals;
}

export function usePaymentSelection(
  availableItems: LisItemForEnvelope[],
  paymentMethod: PaymentMethodType
) {
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

  // Obter items selecionados
  const selectedItems = useMemo(() => {
    return availableItems.filter(item => selectedIds.has(item.id));
  }, [availableItems, selectedIds]);

  // Calcular estado da seleção
  const selectionState = useMemo<PaymentSelectionState>(() => {
    let totalAmount = 0;
    let cardTotals: CardTotals | undefined;

    if (paymentMethod === 'CARTAO') {
      cardTotals = calculateCardTotals(selectedItems);
      totalAmount = cardTotals.netAmount;
    } else {
      totalAmount = calculatePixTotal(selectedItems);
    }

    return {
      selectedIds,
      selectedCount: selectedItems.length,
      totalAmount,
      cardTotals,
    };
  }, [selectedItems, selectedIds, paymentMethod]);

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

  // Selecionar todos os items do tipo de pagamento
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

  // Obter IDs selecionados como array
  const getSelectedIds = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  return {
    // Estado
    selectedIds: selectionState.selectedIds,
    selectedCount: selectionState.selectedCount,
    totalAmount: selectionState.totalAmount,
    cardTotals: selectionState.cardTotals,
    selectableCount: availableItems.length,
    allSelected: availableItems.length > 0 && selectionState.selectedCount === availableItems.length,

    // Ações
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedItems: () => selectedItems,
    getSelectedIds,
  };
}
