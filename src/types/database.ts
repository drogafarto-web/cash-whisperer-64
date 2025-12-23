export type AppRole = 'admin' | 'secretaria' | 'contabilidade' | 'gestor_unidade';
export type AccountType = 'CAIXA' | 'CONTA_BANCARIA' | 'OPERADORA_CARTAO';
export type PartnerType = 'CLIENTE' | 'FORNECEDOR';

export interface Profile {
  id: string;
  email: string;
  name: string;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  description: string | null;
  initial_balance: number;
  active: boolean;
  unit_id: string | null;
  type: AccountType;
  created_at: string;
  updated_at: string;
  // Joined data
  unit?: Unit;
}

export type TaxGroup = 
  | 'RECEITA_SERVICOS' 
  | 'RECEITA_OUTRAS' 
  | 'INSUMOS' 
  | 'PESSOAL' 
  | 'SERVICOS_TERCEIROS' 
  | 'ADMINISTRATIVAS' 
  | 'FINANCEIRAS' 
  | 'TRIBUTARIAS';

export type RecurrenceType = 'RECORRENTE' | 'NAO_RECORRENTE';

export interface Category {
  id: string;
  name: string;
  type: 'ENTRADA' | 'SAIDA';
  description: string | null;
  tax_group: TaxGroup | null;
  recurrence_type: RecurrenceType | null;
  active: boolean;
  entra_fator_r: boolean;
  is_informal: boolean;
  created_at: string;
}

// Tipos para simulação de regularização de pagamentos informais
export interface RegularizationSimulation {
  percentualRegularizacao: number;
  folhaOficial: number;
  pagamentosInformais: number;
  folhaSimulada: number; // oficial + (informal * %)
  fatorRAtual: number;
  fatorRSimulado: number;
  custoAdicionalEncargos: number;
  economiaImposto: number;
  resultadoLiquido: number;
}

export interface PersonnelCostSummary {
  funcionario: string;
  partnerId: string | null;
  salarioOficial: number;
  pagamentosInformais: number;
  custoTotal: number;
  percentualInformal: number;
}

export type TransactionStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO';
export type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'TRANSFERENCIA' | 'PIX' | 'BOLETO' | 'NAO_PAGO';
export type TransactionType = 'ENTRADA' | 'SAIDA';

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  is_recurring: boolean;
  default_category_id: string | null;
  expected_amount: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  default_category?: Category;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  payment_method: PaymentMethod;
  account_id: string;
  category_id: string;
  unit_id: string | null;
  partner_id: string | null;
  description: string | null;
  status: TransactionStatus;
  rejection_reason: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  account?: Account;
  category?: Category;
  partner?: Partner;
  creator?: Profile;
  approver?: Profile;
  documents?: Document[];
  unit?: Unit;
}

export interface Document {
  id: string;
  transaction_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  ocr_data: OcrData | null;
  created_at: string;
}

export interface OcrData {
  valor: number | null;
  data: string | null;
  fornecedor: string | null;
  descricao: string | null;
  confianca: number | null;
  error?: string;
}

export interface CashClosing {
  id: string;
  date: string;
  account_id: string;
  unit_id: string | null;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  notes: string | null;
  envelope_id: string | null;
  closed_by: string;
  created_at: string;
  // Joined data
  account?: Account;
  closer?: Profile;
  unit?: Unit;
}

export interface Import {
  id: string;
  unit_id: string | null;
  file_name: string;
  period_start: string | null;
  period_end: string | null;
  total_records: number;
  imported_records: number;
  skipped_records: number;
  imported_by: string;
  created_at: string;
  // Joined data
  unit?: Unit;
  importer?: Profile;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: Record<string, number>;
  description: string | null;
  category: string | null;
  updated_at: string;
  updated_by: string | null;
}
