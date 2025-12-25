import { supabase } from '@/integrations/supabase/client';
import { ConvenioImportResult } from '@/utils/convenioReportImport';
import { format } from 'date-fns';

export interface ConvenioImportSession {
  id: string;
  unit_id: string | null;
  file_name: string;
  imported_by: string;
  period_start: string | null;
  period_end: string | null;
  total_records: number;
  providers_count: number;
  created_at: string;
}

export interface ConvenioProductionReport {
  id: string;
  import_session_id: string;
  unit_id: string | null;
  provider_name: string;
  is_particular: boolean;
  report_period_start: string | null;
  report_period_end: string | null;
  report_filename: string;
  row_index: number;
  exam_date: string;
  lis_code: string;
  patient_name: string | null;
  company_name: string | null;
  exam_list: string | null;
  amount: number;
  created_at: string;
}

/**
 * Salva uma sessão de importação e todos os registros de produção
 */
export async function saveConvenioImport(
  importResult: ConvenioImportResult,
  unitId: string | null,
  userId: string,
  fileName: string
): Promise<{ sessionId: string; insertedCount: number }> {
  // Cria sessão de importação
  const { data: session, error: sessionError } = await supabase
    .from('convenio_import_sessions')
    .insert({
      unit_id: unitId,
      file_name: fileName,
      imported_by: userId,
      period_start: importResult.period_start ? format(importResult.period_start, 'yyyy-MM-dd') : null,
      period_end: importResult.period_end ? format(importResult.period_end, 'yyyy-MM-dd') : null,
      total_records: importResult.total_records,
      providers_count: importResult.providers_count,
    })
    .select('id')
    .single();

  if (sessionError) throw sessionError;

  // Prepara registros para inserção
  const records: Omit<ConvenioProductionReport, 'id' | 'created_at'>[] = [];
  
  for (const file of importResult.files) {
    for (const row of file.rows) {
      records.push({
        import_session_id: session.id,
        unit_id: unitId,
        provider_name: file.provider_name,
        is_particular: file.is_particular,
        report_period_start: file.period_start ? format(file.period_start, 'yyyy-MM-dd') : null,
        report_period_end: file.period_end ? format(file.period_end, 'yyyy-MM-dd') : null,
        report_filename: file.filename,
        row_index: row.row_index,
        exam_date: format(row.exam_date, 'yyyy-MM-dd'),
        lis_code: row.lis_code,
        patient_name: row.patient_name,
        company_name: row.company_name,
        exam_list: row.exam_list,
        amount: row.amount,
      });
    }
  }

  // Insere em lotes de 500
  let insertedCount = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error: insertError, data } = await supabase
      .from('convenio_production_reports')
      .upsert(batch, {
        onConflict: 'unit_id,lis_code',
        ignoreDuplicates: true,
      })
      .select('id');
    
    if (insertError) {
      console.error('Error inserting batch:', insertError);
      throw insertError;
    }
    
    insertedCount += data?.length || 0;
  }

  return { sessionId: session.id, insertedCount };
}

/**
 * Busca códigos LIS já existentes para uma unidade
 */
export async function fetchExistingLisCodes(unitId: string | null): Promise<Set<string>> {
  let query = supabase
    .from('convenio_production_reports')
    .select('lis_code');

  if (unitId) {
    query = query.eq('unit_id', unitId);
  } else {
    query = query.is('unit_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return new Set((data || []).map(d => d.lis_code));
}

/**
 * Busca detalhes de uma sessão de importação
 */
export async function fetchSessionDetails(sessionId: string): Promise<{
  providers: Array<{
    provider_name: string;
    is_particular: boolean;
    count: number;
    total_amount: number;
    period_start: string | null;
    period_end: string | null;
  }>;
  total_amount: number;
}> {
  const { data, error } = await supabase
    .from('convenio_production_reports')
    .select('provider_name, is_particular, amount, report_period_start, report_period_end')
    .eq('import_session_id', sessionId);

  if (error) throw error;

  // Agrupa por provider
  const providerMap = new Map<string, {
    provider_name: string;
    is_particular: boolean;
    count: number;
    total_amount: number;
    period_start: string | null;
    period_end: string | null;
  }>();

  let total_amount = 0;

  for (const row of data || []) {
    const key = row.provider_name;
    const existing = providerMap.get(key);
    
    if (existing) {
      existing.count++;
      existing.total_amount += row.amount;
      if (row.report_period_start && (!existing.period_start || row.report_period_start < existing.period_start)) {
        existing.period_start = row.report_period_start;
      }
      if (row.report_period_end && (!existing.period_end || row.report_period_end > existing.period_end)) {
        existing.period_end = row.report_period_end;
      }
    } else {
      providerMap.set(key, {
        provider_name: row.provider_name,
        is_particular: row.is_particular,
        count: 1,
        total_amount: row.amount,
        period_start: row.report_period_start,
        period_end: row.report_period_end,
      });
    }
    total_amount += row.amount;
  }

  return {
    providers: Array.from(providerMap.values()).sort((a, b) => b.total_amount - a.total_amount),
    total_amount,
  };
}

/**
 * Busca sessões de importação
 */
export async function fetchConvenioImportSessions(unitId?: string): Promise<ConvenioImportSession[]> {
  let query = supabase
    .from('convenio_import_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Busca relatórios de produção com filtros
 */
export async function fetchConvenioProductionReports(filters: {
  unitId?: string;
  isParticular?: boolean;
  providerName?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ConvenioProductionReport[]> {
  let query = supabase
    .from('convenio_production_reports')
    .select('*')
    .order('exam_date', { ascending: false });

  if (filters.unitId) {
    query = query.eq('unit_id', filters.unitId);
  }

  if (filters.isParticular !== undefined) {
    query = query.eq('is_particular', filters.isParticular);
  }

  if (filters.providerName) {
    query = query.eq('provider_name', filters.providerName);
  }

  if (filters.startDate) {
    query = query.gte('exam_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('exam_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Busca lista de convênios disponíveis
 */
export async function fetchAvailableProviders(unitId?: string): Promise<string[]> {
  let query = supabase
    .from('convenio_production_reports')
    .select('provider_name')
    .eq('is_particular', false);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  // Retorna valores únicos
  const unique = [...new Set((data || []).map(d => d.provider_name))];
  return unique.sort();
}
