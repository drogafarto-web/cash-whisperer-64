import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Supabase
const mockLimit = vi.fn();
const mockNeq = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (columns: string) => {
          mockSelect(columns);
          return {
            eq: (column: string, value: string) => {
              mockEq(column, value);
              return {
                limit: mockLimit,
                neq: (col: string, val: string) => {
                  mockNeq(col, val);
                  return { limit: mockLimit };
                },
              };
            },
          };
        },
      };
    },
  },
}));

// Import after mocking
import {
  checkDuplicatePayableByCodigoBarras,
  checkDuplicatePayableByLinhaDigitavel,
} from '../api/payables.api';

describe('checkDuplicatePayableByCodigoBarras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar false se código de barras estiver vazio', async () => {
    const result = await checkDuplicatePayableByCodigoBarras('');
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deve retornar true se encontrar duplicata', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: '123' }] });

    const result = await checkDuplicatePayableByCodigoBarras('12345678901234567890123456789012345678901234');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('payables');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('codigo_barras', '12345678901234567890123456789012345678901234');
  });

  it('deve retornar false se não encontrar duplicata', async () => {
    mockLimit.mockResolvedValue({ data: [] });

    const result = await checkDuplicatePayableByCodigoBarras('99999999999999999999999999999999999999999999');

    expect(result).toBe(false);
  });

  it('deve retornar false se data for null', async () => {
    mockLimit.mockResolvedValue({ data: null });

    const result = await checkDuplicatePayableByCodigoBarras('12345678901234567890123456789012345678901234');

    expect(result).toBe(false);
  });

  it('deve excluir ID específico da busca quando fornecido', async () => {
    mockLimit.mockResolvedValue({ data: [] });

    await checkDuplicatePayableByCodigoBarras('12345', 'exclude-id-123');

    expect(mockNeq).toHaveBeenCalledWith('id', 'exclude-id-123');
  });
});

describe('checkDuplicatePayableByLinhaDigitavel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar false se linha digitável estiver vazia', async () => {
    const result = await checkDuplicatePayableByLinhaDigitavel('');
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deve retornar true se encontrar duplicata', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: '456' }] });

    const result = await checkDuplicatePayableByLinhaDigitavel('12345.67890 12345.678901 12345.678901 1 12340000012345');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('payables');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('linha_digitavel', '12345.67890 12345.678901 12345.678901 1 12340000012345');
  });

  it('deve retornar false se não encontrar duplicata', async () => {
    mockLimit.mockResolvedValue({ data: [] });

    const result = await checkDuplicatePayableByLinhaDigitavel('99999.99999 99999.999999 99999.999999 9 99990000099999');

    expect(result).toBe(false);
  });

  it('deve retornar false se data for null', async () => {
    mockLimit.mockResolvedValue({ data: null });

    const result = await checkDuplicatePayableByLinhaDigitavel('12345.67890 12345.678901 12345.678901 1 12340000012345');

    expect(result).toBe(false);
  });

  it('deve excluir ID específico da busca quando fornecido', async () => {
    mockLimit.mockResolvedValue({ data: [] });

    await checkDuplicatePayableByLinhaDigitavel('12345.67890', 'exclude-id-456');

    expect(mockNeq).toHaveBeenCalledWith('id', 'exclude-id-456');
  });
});
