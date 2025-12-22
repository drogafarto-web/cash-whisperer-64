export type AppRole = 'admin' | 'secretaria';

export interface Profile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  description: string | null;
  initial_balance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'ENTRADA' | 'SAIDA';
  description: string | null;
  active: boolean;
  created_at: string;
}

export type TransactionStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO';
export type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'TRANSFERENCIA' | 'PIX' | 'BOLETO';
export type TransactionType = 'ENTRADA' | 'SAIDA';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  payment_method: PaymentMethod;
  account_id: string;
  category_id: string;
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
  creator?: Profile;
  approver?: Profile;
  documents?: Document[];
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
  expected_balance: number;
  actual_balance: number;
  difference: number;
  notes: string | null;
  closed_by: string;
  created_at: string;
  // Joined data
  account?: Account;
  closer?: Profile;
}
