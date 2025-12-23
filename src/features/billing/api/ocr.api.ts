import { supabase } from '@/integrations/supabase/client';
import { InvoiceOcrResult } from '@/types/billing';
import { convertPdfToImage, blobToBase64 } from '@/utils/pdfToImage';

export async function processInvoiceOcr(file: File): Promise<InvoiceOcrResult> {
  let base64: string;
  let mimeType: string;

  // Se for PDF, converter para imagem PNG (OpenAI não aceita PDF diretamente)
  if (file.type === 'application/pdf') {
    console.log('Converting PDF to PNG for OCR...');
    const pngBlob = await convertPdfToImage(file, 2); // scale 2 for high quality
    base64 = await blobToBase64(pngBlob);
    mimeType = 'image/png';
    console.log('PDF converted to PNG successfully');
  } else {
    // Já é imagem, usar diretamente
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    mimeType = file.type;
  }

  const { data, error } = await supabase.functions.invoke('ocr-invoice', {
    body: { pdfBase64: base64, mimeType },
  });

  if (error) throw error;
  return data as InvoiceOcrResult;
}
