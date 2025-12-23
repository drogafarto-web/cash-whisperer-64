import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInvoices } from '../hooks/useInvoices';
import { createWrapper, waitFor } from '@/test/utils';
import { mockInvoices } from '@/test/mocks/supabase';
import { Invoice } from '@/types/billing';

vi.mock('../api/invoices.api', () => ({
  fetchInvoices: vi.fn(),
}));

import { fetchInvoices } from '../api/invoices.api';

describe('useInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar lista de invoices', async () => {
    vi.mocked(fetchInvoices).mockResolvedValue(mockInvoices as Invoice[]);
    const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(2);
  });

  it('deve estar em loading durante fetch', () => {
    vi.mocked(fetchInvoices).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
