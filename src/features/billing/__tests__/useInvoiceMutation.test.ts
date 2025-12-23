import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInvoiceMutation } from '../hooks/useInvoiceMutation';
import { createWrapper } from '@/test/utils';

// Mock da API - retorna tipo any para evitar conflitos de tipagem nos testes
vi.mock('../api/invoices.api', () => ({
  upsertInvoice: vi.fn(),
}));

import { upsertInvoice } from '../api/invoices.api';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useInvoiceMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve criar nova invoice', async () => {
    const newInvoice = {
      document_number: '003',
      issue_date: '2025-01-25',
      customer_name: 'Novo Cliente',
      service_value: 500,
      net_value: 475,
      competence_year: 2025,
      competence_month: 1,
    };

    // Mock retorna o objeto parcial (similar ao que a API real faria)
    vi.mocked(upsertInvoice).mockResolvedValue({ id: '3', ...newInvoice } as any);

    const { result } = renderHook(() => useInvoiceMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(newInvoice);
    });

    expect(upsertInvoice).toHaveBeenCalledWith(newInvoice);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nota fiscal salva',
      })
    );
  });

  it('deve atualizar invoice existente', async () => {
    const existingInvoice = {
      id: '1',
      document_number: '001',
      customer_name: 'Cliente Atualizado',
      service_value: 1200,
      net_value: 1140,
    };

    vi.mocked(upsertInvoice).mockResolvedValue(existingInvoice as any);

    const { result } = renderHook(() => useInvoiceMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(existingInvoice);
    });

    expect(upsertInvoice).toHaveBeenCalledWith(existingInvoice);
  });

  it('deve mostrar erro em falha', async () => {
    vi.mocked(upsertInvoice).mockRejectedValue(new Error('Erro ao salvar'));

    const { result } = renderHook(() => useInvoiceMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ document_number: '999' });
      } catch {
        // Esperado
      }
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erro ao salvar',
        variant: 'destructive',
      })
    );
  });
});
