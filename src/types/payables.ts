import { Tables } from '@/integrations/supabase/types';

// Database types
export type SupplierInvoice = Tables<'supplier_invoices'>;
export type Payable = Tables<'payables'>;

// OCR Result types
export interface SupplierInvoiceOcrResult {
  document_number: string | null;
  document_series: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  issue_date: string | null;
  total_value: number | null;
  description: string | null;
  payment_conditions: string | null;
  installments_count: number | null;
  parcelas: Parcela[];
  confidence: number;
}

export interface Parcela {
  numero: number;
  valor: number;
  vencimento: string;
  linha_digitavel?: string;
}

export interface BoletoOcrResult {
  linha_digitavel: string | null;
  codigo_barras: string | null;
  banco_codigo: string | null;
  banco_nome: string | null;
  beneficiario: string | null;
  beneficiario_cnpj: string | null;
  valor: number | null;
  vencimento: string | null;
  confidence: number;
}

// Reconciliation types
export type PayableMatchType = 'exact_value_date' | 'linha_digitavel' | 'beneficiario_name' | 'manual';

export interface PayableMatchResult {
  payableId: string;
  payable: Payable;
  transactionId?: string;
  bankStatementDescription?: string;
  matchType: PayableMatchType;
  confidence: number; // 0-100
  valueDiff?: number;
  dateDiff?: number; // days difference
}

export interface ReconciliationSuggestion {
  payable: Payable;
  matches: PayableMatchResult[];
  bestMatch?: PayableMatchResult;
}

// Form types
export interface SupplierInvoiceFormData {
  document_number: string;
  document_series?: string;
  supplier_name: string;
  supplier_cnpj?: string;
  issue_date: string;
  due_date?: string;
  total_value: number;
  description?: string;
  payment_conditions?: string;
  installments_count?: number;
  unit_id?: string;
  category_id?: string;
}

export interface PayableFormData {
  beneficiario: string;
  beneficiario_cnpj?: string;
  valor: number;
  vencimento: string;
  linha_digitavel?: string;
  codigo_barras?: string;
  banco_codigo?: string;
  banco_nome?: string;
  description?: string;
  tipo: 'boleto' | 'titulo';
  parcela_numero?: number;
  parcela_total?: number;
  supplier_invoice_id?: string;
  unit_id?: string;
  category_id?: string;
  file_path?: string;
  file_name?: string;
}

// Status types
export type PayableStatus = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
export type SupplierInvoiceStatus = 'pendente' | 'parcial' | 'quitada' | 'cancelada';

// Tax Document OCR types
export type TaxDocumentType = 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'folha' | 'nf_servico' | 'outro';
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface TaxDocumentOcrResult {
  tipo_documento: TaxDocumentType;
  valor: number | null;
  vencimento: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  cnpj: string | null;
  beneficiario: string | null;
  competencia: { ano: number; mes: number } | null;
  pix_key: string | null;
  pix_tipo: PixKeyType | null;
  confidence: number;
  raw_text?: string;
}

export const TAX_DOCUMENT_LABELS: Record<TaxDocumentType, string> = {
  das: 'DAS - Simples Nacional',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  folha: 'Folha de Pagamento',
  nf_servico: 'NF de Serviço',
  outro: 'Outro',
};
