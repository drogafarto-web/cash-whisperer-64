import { useMutation } from '@tanstack/react-query';
import { processInvoiceOcr } from '../api/ocr.api';
import { useToast } from '@/hooks/use-toast';

export function useInvoiceOcr() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: processInvoiceOcr,
    onError: (error) => {
      console.error('OCR error:', error);
      toast({
        title: 'Erro no OCR',
        description: 'Não foi possível processar o arquivo. Preencha os dados manualmente.',
        variant: 'destructive',
      });
    },
  });
}
