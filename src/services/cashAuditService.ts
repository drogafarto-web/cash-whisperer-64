import { supabase } from '@/integrations/supabase/client';

export type CashAuditAction = 
  | 'envelope_created'
  | 'envelope_printed'
  | 'pix_confirmed'
  | 'card_confirmed'
  | 'cash_hub_viewed'
  | 'fiscal_control_viewed'
  | 'fiscal_control_payment_created'
  | 'bank_statement_uploaded'
  | 'bank_statement_viewed';

export interface AuditLogEntry {
  action: CashAuditAction;
  user_id: string;
  unit_id: string;
  target_id?: string;
  target_type?: string;
  target_count?: number;
  amount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an action to the cash_audit_log table
 */
export async function logCashAction(entry: AuditLogEntry): Promise<void> {
  try {
    const insertData = {
      action: entry.action,
      user_id: entry.user_id,
      unit_id: entry.unit_id,
      target_id: entry.target_id || null,
      target_type: entry.target_type || null,
      target_count: entry.target_count || null,
      amount: entry.amount || null,
      metadata: entry.metadata as Record<string, unknown> | null,
    };
    
    const { error } = await supabase
      .from('cash_audit_log')
      .insert(insertData as never);

    if (error) {
      console.error('Failed to log cash audit action:', error);
      // Don't throw - audit logging should not break the main flow
    }
  } catch (err) {
    console.error('Error logging cash audit action:', err);
  }
}

/**
 * Log envelope creation
 */
export async function logEnvelopeCreated(params: {
  userId: string;
  unitId: string;
  envelopeId: string;
  itemCount: number;
  amount: number;
  lisCodes: string[];
}): Promise<void> {
  await logCashAction({
    action: 'envelope_created',
    user_id: params.userId,
    unit_id: params.unitId,
    target_id: params.envelopeId,
    target_type: 'cash_envelope',
    target_count: params.itemCount,
    amount: params.amount,
    metadata: { lis_codes: params.lisCodes },
  });
}

/**
 * Log envelope label printed
 */
export async function logEnvelopePrinted(params: {
  userId: string;
  unitId: string;
  envelopeId: string;
  reprintCount: number;
}): Promise<void> {
  await logCashAction({
    action: 'envelope_printed',
    user_id: params.userId,
    unit_id: params.unitId,
    target_id: params.envelopeId,
    target_type: 'cash_envelope',
    metadata: { reprint_count: params.reprintCount },
  });
}

/**
 * Log PIX confirmation
 */
export async function logPixConfirmed(params: {
  userId: string;
  unitId: string;
  itemCount: number;
  amount: number;
  itemIds: string[];
}): Promise<void> {
  await logCashAction({
    action: 'pix_confirmed',
    user_id: params.userId,
    unit_id: params.unitId,
    target_type: 'lis_closure_items',
    target_count: params.itemCount,
    amount: params.amount,
    metadata: { item_ids: params.itemIds },
  });
}

/**
 * Log Card confirmation
 */
export async function logCardConfirmed(params: {
  userId: string;
  unitId: string;
  itemCount: number;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  itemIds: string[];
}): Promise<void> {
  await logCashAction({
    action: 'card_confirmed',
    user_id: params.userId,
    unit_id: params.unitId,
    target_type: 'lis_closure_items',
    target_count: params.itemCount,
    amount: params.netAmount,
    metadata: {
      item_ids: params.itemIds,
      gross_amount: params.grossAmount,
      fee_amount: params.feeAmount,
    },
  });
}

/**
 * Fetch audit logs for a unit (for reporting)
 */
export async function getAuditLogs(params: {
  unitId?: string;
  startDate?: string;
  endDate?: string;
  action?: CashAuditAction;
  limit?: number;
}): Promise<unknown[]> {
  let query = supabase
    .from('cash_audit_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (params.unitId) {
    query = query.eq('unit_id', params.unitId);
  }
  if (params.startDate) {
    query = query.gte('created_at', params.startDate);
  }
  if (params.endDate) {
    query = query.lte('created_at', params.endDate);
  }
  if (params.action) {
    query = query.eq('action', params.action);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Log fiscal control module access
 */
export async function logFiscalControlAccess(params: {
  userId: string;
  action: 'viewed' | 'created';
  amount?: number;
  categoryId?: string;
}): Promise<void> {
  await logCashAction({
    action: params.action === 'viewed' 
      ? 'fiscal_control_viewed' 
      : 'fiscal_control_payment_created',
    user_id: params.userId,
    unit_id: 'system',
    amount: params.amount,
    metadata: { 
      category_id: params.categoryId,
      timestamp: new Date().toISOString()
    },
  });
}

/**
 * Log bank statement actions
 */
export async function logBankStatementAction(params: {
  userId: string;
  action: 'uploaded' | 'viewed';
  fileName?: string;
  accountName?: string;
}): Promise<void> {
  await logCashAction({
    action: params.action === 'uploaded' 
      ? 'bank_statement_uploaded' 
      : 'bank_statement_viewed',
    user_id: params.userId,
    unit_id: 'system',
    metadata: { 
      file_name: params.fileName,
      account_name: params.accountName,
      timestamp: new Date().toISOString()
    },
  });
}
