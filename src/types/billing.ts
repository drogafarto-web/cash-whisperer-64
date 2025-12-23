import { Unit } from './database';

export type PayerType = 'prefeitura' | 'convenio' | 'empresa';
export type InvoiceStatus = 'ABERTA' | 'RECEBIDA' | 'CANCELADA';

export interface Payer {
  id: string;
  name: string;
  cnpj: string | null;
  type: PayerType;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  document_number: string;
  document_full_number: string | null;
  verification_code: string | null;
  issue_date: string;
  competence_year: number;
  competence_month: number;
  service_value: number;
  deductions: number;
  iss_value: number;
  net_value: number;
  issuer_name: string | null;
  issuer_cnpj: string | null;
  payer_id: string | null;
  customer_name: string;
  customer_cnpj: string | null;
  customer_city: string | null;
  description: string | null;
  service_code: string | null;
  cnae: string | null;
  unit_id: string | null;
  file_path: string | null;
  file_name: string | null;
  status: InvoiceStatus;
  received_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  payer?: Payer;
  unit?: Unit;
}

export interface InvoiceOcrResult {
  document_number: string | null;
  document_full_number: string | null;
  verification_code: string | null;
  issue_date: string | null;
  competence_year: number | null;
  competence_month: number | null;
  service_value: number | null;
  deductions: number | null;
  iss_value: number | null;
  net_value: number | null;
  issuer_name: string | null;
  issuer_cnpj: string | null;
  customer_name: string | null;
  customer_cnpj: string | null;
  customer_city: string | null;
  description: string | null;
  service_code: string | null;
  cnae: string | null;
  confidence: number;
  error?: string;
}

export interface BillingSummary {
  month: number;
  year: number;
  caixaTotal: number;
  invoicesTotal: number;
  grandTotal: number;
  caixaByMethod: {
    dinheiro: number;
    pix: number;
    cartao: number;
  };
  invoicesByPayer: Array<{
    payerName: string;
    total: number;
  }>;
}
