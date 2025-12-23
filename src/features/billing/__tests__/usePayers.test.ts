import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePayers } from '../hooks/usePayers';
import { createWrapper, waitFor } from '@/test/utils';
import { mockPayers } from '@/test/mocks/supabase';
import { Payer } from '@/types/billing';

vi.mock('../api/payers.api', () => ({
  fetchPayers: vi.fn(),
}));

import { fetchPayers } from '../api/payers.api';

describe('usePayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar convênios ativos por padrão', async () => {
    vi.mocked(fetchPayers).mockResolvedValue(mockPayers as Payer[]);
    const { result } = renderHook(() => usePayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPayers).toHaveBeenCalledWith(true);
  });

  it('deve retornar todos quando activeOnly = false', async () => {
    vi.mocked(fetchPayers).mockResolvedValue(mockPayers as Payer[]);
    const { result } = renderHook(() => usePayers(false), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPayers).toHaveBeenCalledWith(false);
  });
});
