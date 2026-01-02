import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BoletoOcrResult } from '@/types/payables';

interface UseBoletoOcrReturn {
  analyze: (file: File) => Promise<void>;
  isLoading: boolean;
  result: BoletoOcrResult | null;
  error: string | null;
  reset: () => void;
}

export function useBoletoOcr(): UseBoletoOcrReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BoletoOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyze = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const imageBase64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const { data, error: fnError } = await supabase.functions.invoke('ocr-boleto', {
        body: { imageBase64, mimeType },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao processar boleto');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.ocrData) {
        setResult(data.ocrData);
      } else {
        throw new Error('Nenhum dado extraído do boleto');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('useBoletoOcr error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  return { analyze, isLoading, result, error, reset };
}
