import { useMutation } from '@tanstack/react-query';
import { processInvoiceOcr } from '../api/ocr.api';
import { toast } from 'sonner';

export function useInvoiceOcr() {
  return useMutation({
    mutationFn: processInvoiceOcr,
    onError: (error) => {
      console.error('OCR error:', error);
      toast.error('Erro no OCR', {
        description: 'Não foi possível processar o arquivo. Preencha os dados manualmente.',
      });
    },
  });
}
