import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ocrSupplierInvoice, ocrBoleto, fileToBase64 } from '../api/ocr.api';
import { SupplierInvoiceOcrResult, BoletoOcrResult } from '@/types/payables';

export function useSupplierInvoiceOcr() {
  const [isProcessing, setIsProcessing] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<SupplierInvoiceOcrResult> => {
      setIsProcessing(true);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        const result = await ocrSupplierInvoice(base64, mimeType);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error) => {
      toast.error('Erro no OCR', {
        description: error instanceof Error ? error.message : 'Não foi possível processar a imagem.',
      });
    },
  });

  return {
    processFile: mutation.mutateAsync,
    isProcessing: isProcessing || mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useBoletoOcr() {
  const [isProcessing, setIsProcessing] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<BoletoOcrResult> => {
      setIsProcessing(true);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        const result = await ocrBoleto(base64, mimeType);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error) => {
      toast.error('Erro no OCR', {
        description: error instanceof Error ? error.message : 'Não foi possível processar a imagem.',
      });
    },
  });

  return {
    processFile: mutation.mutateAsync,
    isProcessing: isProcessing || mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
