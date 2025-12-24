/**
 * Hook para gerenciar seleção de códigos LIS no fechamento de caixa
 * 
 * Lógica de mapeamento de componentes:
 * 
 * | Tipo de Pagamento               | cash_component        | receivable_component | payment_status inicial |
 * |---------------------------------|-----------------------|----------------------|------------------------|
 * | Particular (100% pago)          | amount                | 0                    | PENDENTE               |
 * | Convênio puro (sem complemento) | 0                     | amount               | A_RECEBER              |
 * | Convênio com complemento        | valor pago paciente   | valor do convênio    | PENDENTE               |
 * 
 * O cash_component é o valor que entra no envelope físico.
 * O receivable_component é o valor a faturar para convênios.
 */

import { useState, useCallback, useMemo } from 'react';

export interface LisClosureItemForSelection {
  id: string;
  lis_code: string;
  date: string;
  patient_name: string | null;
  convenio: string | null;
  payment_method: string;
  amount: number;
  gross_amount: number | null;
  status: string;
  payment_status: string;
  cash_component: number;
  receivable_component: number;
  daily_closing_id: string | null;
}

export interface SelectionState {
  selectedIds: Set<string>;
  expectedCash: number;
  selectedCount: number;
}

/**
 * Calcula os componentes de caixa e recebível baseado no tipo de pagamento
 * 
 * @param isParticular - Se é pagamento particular (sem convênio)
 * @param paymentMethod - Método de pagamento (DINHEIRO, PIX, CARTAO, NAO_PAGO)
 * @param amount - Valor pago pelo paciente
 * @param grossAmount - Valor bruto do atendimento (inclui parte do convênio)
 */
export function calculatePaymentComponents(
  isParticular: boolean,
  paymentMethod: string,
  amount: number,
  grossAmount: number | null
): { cashComponent: number; receivableComponent: number; paymentStatus: string } {
  // Se é NAO_PAGO, nada vai pro caixa ainda
  if (paymentMethod === 'NAO_PAGO') {
    return {
      cashComponent: 0,
      receivableComponent: grossAmount || amount,
      paymentStatus: 'A_RECEBER',
    };
  }

  // Se é particular, todo o valor é cash
  if (isParticular) {
    return {
      cashComponent: amount,
      receivableComponent: 0,
      paymentStatus: 'PENDENTE',
    };
  }

  // Se é convênio e tem valor pago, é complemento
  if (amount > 0) {
    const receivable = (grossAmount || amount) - amount;
    return {
      cashComponent: amount,
      receivableComponent: Math.max(0, receivable),
      paymentStatus: 'PENDENTE',
    };
  }

  // Convênio puro (sem pagamento do paciente)
  return {
    cashComponent: 0,
    receivableComponent: grossAmount || 0,
    paymentStatus: 'A_RECEBER',
  };
}

export function useCashClosingSelection(items: LisClosureItemForSelection[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Inicializar seleção com itens pendentes que têm cash_component > 0
  const initializeSelection = useCallback(() => {
    const eligibleItems = items.filter(
      item => 
        item.payment_status === 'PENDENTE' && 
        item.cash_component > 0 &&
        !item.daily_closing_id
    );
    const ids = new Set(eligibleItems.map(item => item.id));
    setSelectedIds(ids);
    setInitialized(true);
  }, [items]);

  // Alternar seleção de um item
  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        // Só permite selecionar itens que não estão vinculados a outro fechamento
        const item = items.find(i => i.id === itemId);
        if (item && !item.daily_closing_id && item.payment_status !== 'A_RECEBER') {
          next.add(itemId);
        }
      }
      return next;
    });
  }, [items]);

  // Selecionar todos os elegíveis
  const selectAll = useCallback(() => {
    const eligibleItems = items.filter(
      item => 
        (item.payment_status === 'PENDENTE' || item.payment_status === 'PAGO_POSTERIOR') && 
        item.cash_component > 0 &&
        !item.daily_closing_id
    );
    setSelectedIds(new Set(eligibleItems.map(item => item.id)));
  }, [items]);

  // Desselecionar todos
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Calcular soma dinâmica do cash esperado
  const selectionState = useMemo<SelectionState>(() => {
    let expectedCash = 0;
    let selectedCount = 0;

    for (const item of items) {
      if (selectedIds.has(item.id)) {
        expectedCash += item.cash_component || 0;
        selectedCount++;
      }
    }

    return {
      selectedIds,
      expectedCash,
      selectedCount,
    };
  }, [items, selectedIds]);

  // Verificar se item pode ser selecionado
  const canSelectItem = useCallback((itemId: string): boolean => {
    const item = items.find(i => i.id === itemId);
    if (!item) return false;
    return (
      !item.daily_closing_id && 
      item.payment_status !== 'A_RECEBER' &&
      item.cash_component > 0
    );
  }, [items]);

  // Verificar se item está vinculado a outro fechamento
  const isItemLocked = useCallback((itemId: string): boolean => {
    const item = items.find(i => i.id === itemId);
    return !!(item?.daily_closing_id);
  }, [items]);

  return {
    selectedIds,
    selectionState,
    initialized,
    initializeSelection,
    toggleSelection,
    selectAll,
    deselectAll,
    canSelectItem,
    isItemLocked,
    isSelected: (id: string) => selectedIds.has(id),
  };
}
