import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInvoiceOcr } from '../hooks/useInvoiceOcr';
import { createWrapper } from '@/test/utils';
import { mockOcrResult } from '@/test/mocks/supabase';

// Mock da API
vi.mock('../api/ocr.api', () => ({
  processInvoiceOcr: vi.fn(),
}));

import { processInvoiceOcr } from '../api/ocr.api';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useInvoiceOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve processar arquivo PDF com sucesso', async () => {
    vi.mocked(processInvoiceOcr).mockResolvedValue(mockOcrResult);

    const mockFile = new File(['pdf content'], 'nfse.pdf', {
      type: 'application/pdf',
    });

    const { result } = renderHook(() => useInvoiceOcr(), {
      wrapper: createWrapper(),
    });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync(mockFile);
    });

    expect(processInvoiceOcr).toHaveBeenCalledWith(mockFile);
    expect(response).toEqual(mockOcrResult);
  });

  it('deve mostrar toast de erro em falha', async () => {
    vi.mocked(processInvoiceOcr).mockRejectedValue(new Error('OCR failed'));

    const mockFile = new File(['pdf content'], 'nfse.pdf', {
      type: 'application/pdf',
    });

    const { result } = renderHook(() => useInvoiceOcr(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync(mockFile);
      } catch {
        // Esperado
      }
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erro no OCR',
        variant: 'destructive',
      })
    );
  });

  it('deve estar em loading durante processamento', async () => {
    vi.mocked(processInvoiceOcr).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const mockFile = new File(['pdf content'], 'nfse.pdf', {
      type: 'application/pdf',
    });

    const { result } = renderHook(() => useInvoiceOcr(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(mockFile);
    });

    expect(result.current.isPending).toBe(true);
  });
});
