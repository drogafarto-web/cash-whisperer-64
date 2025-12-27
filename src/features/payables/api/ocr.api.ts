import { supabase } from '@/integrations/supabase/client';
import { SupplierInvoiceOcrResult, BoletoOcrResult } from '@/types/payables';

// Normalized OCR result for both Boleto and PIX
export interface NormalizedPaymentOcr {
  valor: number | null;
  data: string | null; // YYYY-MM-DD
  beneficiario: string | null;
  identificador: string | null; // linha digitável for boleto, transaction id for pix
  tipo: 'boleto' | 'pix';
  confidence: number;
  raw: BoletoOcrResult | ReceiptOcrResult;
}

export interface ReceiptOcrResult {
  valor: number | null;
  data: string | null;
  fornecedor: string | null;
  descricao: string | null;
  confianca: number;
}

export async function ocrSupplierInvoice(
  imageBase64: string,
  mimeType: string
): Promise<SupplierInvoiceOcrResult> {
  const { data, error } = await supabase.functions.invoke('ocr-supplier-invoice', {
    body: { imageBase64, mimeType },
  });

  if (error) throw error;
  return data as SupplierInvoiceOcrResult;
}

export async function ocrBoleto(
  imageBase64: string,
  mimeType: string
): Promise<BoletoOcrResult> {
  const { data, error } = await supabase.functions.invoke('ocr-boleto', {
    body: { imageBase64, mimeType },
  });

  if (error) throw error;
  
  // Edge function returns { ocrData: result }
  if (data?.ocrData) {
    return data.ocrData as BoletoOcrResult;
  }
  
  // Handle case where error is in response body
  if (data?.error) {
    throw new Error(data.error);
  }
  
  return data as BoletoOcrResult;
}

export async function ocrReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ReceiptOcrResult> {
  const { data, error } = await supabase.functions.invoke('ocr-receipt', {
    body: { imageBase64, mimeType },
  });

  if (error) throw error;
  
  // Edge function returns { ocrData: result }
  if (data?.ocrData) {
    return data.ocrData as ReceiptOcrResult;
  }
  
  // Handle case where error is in response body
  if (data?.error) {
    throw new Error(data.error);
  }
  
  return data as ReceiptOcrResult;
}

// Normalize boleto OCR to common format
export function normalizeBoletoOcr(result: BoletoOcrResult): NormalizedPaymentOcr {
  return {
    valor: result.valor,
    data: result.vencimento,
    beneficiario: result.beneficiario,
    identificador: result.linha_digitavel || result.codigo_barras,
    tipo: 'boleto',
    confidence: result.confidence || 0,
    raw: result,
  };
}

// Normalize receipt OCR (PIX) to common format
export function normalizeReceiptOcr(result: ReceiptOcrResult): NormalizedPaymentOcr {
  return {
    valor: result.valor,
    data: result.data,
    beneficiario: result.fornecedor,
    identificador: null,
    tipo: 'pix',
    confidence: result.confianca || 0,
    raw: result,
  };
}

export async function uploadPayableFile(
  file: File,
  folder: 'supplier-invoices' | 'boletos' | 'receipts'
): Promise<{ path: string; url: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('payables')
    .upload(fileName, file);

  if (uploadError) {
    // If bucket doesn't exist, try creating it
    if (uploadError.message.includes('not found')) {
      throw new Error('Storage bucket "payables" not found. Please create it in the storage settings.');
    }
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from('payables')
    .getPublicUrl(fileName);

  return {
    path: fileName,
    url: urlData.publicUrl,
  };
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 content
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
