import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { notifySuccess, notifyError } from '@/lib/notify';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseLisXls, LisRecord, ParseResult, getPaymentMethodIcon, formatCurrency, extractLisCodeFromDescription } from '@/utils/lisImport';
import { ParseLogViewer, LogEntry } from '@/components/import/ParseLogViewer';
import { FinancialResolutionModal, ResolutionData } from '@/components/import/FinancialResolutionModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileUp,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentMethod } from '@/types/database';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ID da categoria "Recebimento de Clientes" 
const CATEGORY_RECEBIMENTO_CLIENTES = '7ee0b99b-92a7-4e8f-bd71-337dbf0baf7e';

export default function DailyMovement() {
  const navigate = useNavigate();
  
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [unitAccounts, setUnitAccounts] = useState<Record<string, string>>({});
  
  // Visual logs state
  const [parseLogs, setParseLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  // Financial resolution state
  const [resolutionModal, setResolutionModal] = useState<{
    open: boolean;
    recordIndex: number | null;
    record: LisRecord | null;
  }>({ open: false, recordIndex: null, record: null });
  
  // Resolved records with payment method and justification
  const [resolvedRecords, setResolvedRecords] = useState<Map<number, ResolutionData>>(new Map());

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setParseLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  }, []);

  // Carregar contas de caixa por unidade
  const loadUnitAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, unit_id')
      .eq('type', 'CAIXA')
      .eq('active', true);

    if (data) {
      const mapping: Record<string, string> = {};
      data.forEach(account => {
        if (account.unit_id) {
          mapping[account.unit_id] = account.id;
        }
      });
      // Se não há conta específica por unidade, usar a primeira conta caixa disponível
      if (Object.keys(mapping).length === 0 && data.length > 0) {
        // Usar conta sem unidade como fallback para todas
        const fallbackAccount = data.find(a => !a.unit_id) || data[0];
        if (fallbackAccount) {
          mapping['__fallback__'] = fallbackAccount.id;
        }
      }
      setUnitAccounts(mapping);
    }
  };

  const checkDuplicates = async (records: LisRecord[], periodStart: string | null, periodEnd: string | null): Promise<LisRecord[]> => {
    if (!periodStart || !periodEnd) return records;

    // Buscar transações LIS existentes no período
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('description, date')
      .like('description', '[LIS %')
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (!existingTx || existingTx.length === 0) return records;

    // Criar Set de chaves existentes (data + código LIS)
    const existingKeys = new Set<string>();
    existingTx.forEach(t => {
      const lisCode = extractLisCodeFromDescription(t.description || '');
      if (lisCode) {
        existingKeys.add(`${t.date}_${lisCode}`);
      }
    });

    // Marcar duplicatas
    return records.map(record => {
      const key = `${record.data}_${record.codigo}`;
      if (existingKeys.has(key)) {
        return {
          ...record,
          isDuplicate: true,
          duplicateReason: 'Já importado anteriormente',
        };
      }
      return record;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous logs
    setParseLogs([]);
    addLog('info', `📁 Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/wps-office.xls',
      'application/wps-office.xlsx',
    ];

    const isValidType = validTypes.includes(file.type) || 
      file.name.endsWith('.xls') || 
      file.name.endsWith('.xlsx');

    if (!isValidType) {
      addLog('error', '❌ Tipo de arquivo inválido. Apenas XLS/XLSX são aceitos.');
      notifyError('Arquivo inválido', 'Por favor, selecione um arquivo XLS ou XLSX.');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      addLog('info', '🔄 Carregando contas de unidades...');
      await loadUnitAccounts();
      addLog('success', `✅ Contas carregadas`);

      addLog('info', '📊 Processando arquivo Excel...');
      const buffer = await file.arrayBuffer();
      const result = parseLisXls(buffer);

      // Log de tipo de relatório detectado
      if (result.reportType) {
        if (result.reportType.isSupported) {
          addLog('success', `📋 Tipo detectado: ${result.reportType.reason} (confiança ${result.reportType.confidence})`);
        } else {
          addLog('error', `❌ Tipo incompatível: ${result.reportType.reason}`);
          addLog('warn', '💡 Este importador requer o "Relatório Movimento Diário Detalhado" do LIS');
        }
      }

      // Log de diagnóstico se houver
      if (result.diagnostics) {
        const d = result.diagnostics;
        
        // Log se usou planilha diferente da primeira
        if (d.sheetsAttempted && d.sheetsAttempted.length > 1 && d.sheetUsed !== d.sheetsAttempted[0]) {
          addLog('info', `📑 Dados encontrados na planilha "${d.sheetUsed}" (não era a primeira)`);
        } else {
          addLog('info', `📑 Planilha: "${d.sheetUsed}", Cabeçalho: linha ${d.headerRowIndex}, Dados: linha ${d.startRow}`);
        }
        
        addLog('info', `📊 Linhas escaneadas: ${d.rowsScanned}`);
        
        if (d.rowsSkippedInvalidDate > 0 || d.rowsSkippedBySkipRow > 0 || d.rowsSkippedTooFewColumns > 0) {
          addLog('warn', `⏭️ Puladas: ${d.rowsSkippedInvalidDate} sem data, ${d.rowsSkippedBySkipRow} padrão skip, ${d.rowsSkippedTooFewColumns} poucas colunas`);
        }
        
        // Se nenhum registro encontrado, mostrar preview das linhas brutas
        if (result.totalRecords === 0 && d.rawPreview && d.rawPreview.length > 0) {
          addLog('warn', '📋 Preview das primeiras linhas do arquivo:');
          d.rawPreview.slice(0, 3).forEach((row, i) => {
            const cells = row.slice(0, 6).join(' | ');
            addLog('info', `   Linha ${i + 1}: ${cells}`);
          });
          
          if (d.sheetsAttempted && d.sheetsAttempted.length > 1) {
            addLog('info', `📑 Planilhas tentadas: ${d.sheetsAttempted.join(', ')}`);
          }
        }
      }

      addLog('info', `📅 Período detectado: ${result.periodStart || 'N/A'} a ${result.periodEnd || 'N/A'}`);
      addLog('info', `📋 Total de registros parseados: ${result.totalRecords}`);
      
      if (result.validRecords > 0) {
        addLog('success', `✅ ${result.validRecords} registros válidos encontrados`);
      } else {
        addLog('error', '❌ Nenhum registro válido encontrado');
        if (result.diagnostics && result.diagnostics.rowsSkippedInvalidDate > 0) {
          addLog('warn', '💡 Verifique se o arquivo é o "Relatório Movimento Diário Detalhado" do LIS');
        }
      }

      if (result.invalidRecords > 0) {
        addLog('warn', `⚠️ ${result.invalidRecords} registros com erro/ignorados`);
      }

      // Verificar duplicatas
      addLog('info', '🔍 Verificando duplicatas no banco de dados...');
      const recordsWithDuplicates = await checkDuplicates(result.records, result.periodStart, result.periodEnd);
      const duplicateCount = recordsWithDuplicates.filter(r => r.isDuplicate).length;
      
      if (duplicateCount > 0) {
        addLog('warn', `⚠️ ${duplicateCount} registros já importados anteriormente`);
      } else {
        addLog('success', '✅ Nenhuma duplicata encontrada');
      }

      // Breakdown por forma de pagamento
      const byPayment = result.records.reduce((acc, r) => {
        if (r.valorPago > 0) {
          acc[r.paymentMethod] = (acc[r.paymentMethod] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      if (Object.keys(byPayment).length > 0) {
        addLog('info', `💳 Por forma: ${Object.entries(byPayment).map(([k,v]) => `${k}=${v}`).join(', ')}`);
      }

      const updatedResult: ParseResult = {
        ...result,
        records: recordsWithDuplicates,
        duplicateRecords: duplicateCount,
        validRecords: recordsWithDuplicates.filter(r => !r.error && r.valorPago > 0 && !r.isDuplicate).length,
      };

      setParseResult(updatedResult);

      // Pré-selecionar TODOS os registros válidos com valor > 0 (particular OU convênio) e NÃO duplicatas
      const preSelected = new Set<number>();
      updatedResult.records.forEach((record, index) => {
        if (!record.error && record.valorPago > 0 && !record.isDuplicate) {
          preSelected.add(index);
        }
      });
      setSelectedIds(preSelected);

      addLog('success', `🎉 Processamento concluído! ${preSelected.size} registros pré-selecionados.`);

      const duplicateMsg = duplicateCount > 0 ? ` ${duplicateCount} duplicatas detectadas.` : '';
      notifySuccess('Arquivo processado', `${result.totalRecords} registros encontrados, ${updatedResult.validRecords} válidos.${duplicateMsg}`);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      addLog('error', `❌ Erro ao processar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      notifyError('Erro ao processar arquivo', 'Não foi possível ler o arquivo. Verifique se é um relatório do LIS válido.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a record requires financial resolution (isNaoPago but has valorBruto > 0)
  const requiresResolution = (record: LisRecord): boolean => {
    return record.isNaoPago && record.valorBruto > 0 && !record.error && !record.isDuplicate;
  };

  // Check if a record has been resolved
  const isRecordResolved = (index: number): boolean => {
    return resolvedRecords.has(index);
  };

  const handleRecordClick = (index: number, record: LisRecord) => {
    // If record requires resolution and is not yet resolved, open modal
    if (requiresResolution(record) && !isRecordResolved(index)) {
      setResolutionModal({ open: true, recordIndex: index, record });
      return;
    }
    
    // Otherwise, toggle selection normally
    toggleRecord(index);
  };

  const handleResolution = (data: ResolutionData) => {
    if (resolutionModal.recordIndex === null) return;
    
    // Save resolution data
    const newResolved = new Map(resolvedRecords);
    newResolved.set(resolutionModal.recordIndex, data);
    setResolvedRecords(newResolved);
    
    // Select the record
    const newSelected = new Set(selectedIds);
    newSelected.add(resolutionModal.recordIndex);
    setSelectedIds(newSelected);
    
    // Close modal
    setResolutionModal({ open: false, recordIndex: null, record: null });
    
    notifySuccess('Pendência resolvida', 'O registro foi marcado como resolvido e incluído na seleção.');
  };

  const toggleRecord = (index: number) => {
    const record = parseResult?.records[index];
    if (!record) return;
    
    // Prevent deselecting a resolved record (they need to stay selected once resolved)
    // But allow deselecting if it's not a resolved pending record
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      // If it's a resolved pending record, just remove it
      if (isRecordResolved(index)) {
        // Also remove from resolved records
        const newResolved = new Map(resolvedRecords);
        newResolved.delete(index);
        setResolvedRecords(newResolved);
      }
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (!parseResult) return;
    
    // Count valid records (excluding those that require resolution and aren't resolved)
    const validRecords = parseResult.records.filter((r, i) => {
      if (r.error || r.isDuplicate) return false;
      // For pending records, only count if resolved
      if (requiresResolution(r)) return isRecordResolved(i);
      // Normal records with payment
      return r.valorPago > 0;
    });
    
    if (selectedIds.size === validRecords.length && selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      const allValid = new Set<number>();
      parseResult.records.forEach((record, index) => {
        if (record.error || record.isDuplicate) return;
        // For pending records, only select if resolved
        if (requiresResolution(record)) {
          if (isRecordResolved(index)) allValid.add(index);
          return;
        }
        // Normal records with payment
        if (record.valorPago > 0) {
          allValid.add(index);
        }
      });
      setSelectedIds(allValid);
    }
  };

  const selectedRecords = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.records.filter((_, i) => selectedIds.has(i));
  }, [parseResult, selectedIds]);

  const totalSelectedValue = useMemo(() => {
    return selectedRecords.reduce((sum, r, i) => {
      // For resolved records, use the resolved amount
      const originalIndex = parseResult?.records.indexOf(r);
      if (originalIndex !== undefined && resolvedRecords.has(originalIndex)) {
        return sum + resolvedRecords.get(originalIndex)!.amount;
      }
      return sum + r.valorPago;
    }, 0);
  }, [selectedRecords, parseResult, resolvedRecords]);

  const handleImport = async () => {
    if (!user || !parseResult || selectedIds.size === 0) return;

    setIsImporting(true);

    try {
      const transactions = selectedRecords.map((record, idx) => {
        // Encontrar conta de caixa para a unidade
        let accountId = record.unitId ? unitAccounts[record.unitId] : null;
        if (!accountId) {
          accountId = unitAccounts['__fallback__'] || Object.values(unitAccounts)[0];
        }

        // Check if this is a resolved pending record
        const originalIndex = parseResult?.records.indexOf(record);
        const resolution = originalIndex !== undefined ? resolvedRecords.get(originalIndex) : undefined;
        
        // Use resolved data if available
        const amount = resolution ? resolution.amount : record.valorPago;
        const paymentMethod = resolution ? resolution.paymentMethod : record.paymentMethod;
        const description = resolution 
          ? `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio} | PENDÊNCIA RESOLVIDA: ${resolution.justification}`
          : `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio}`;

        return {
          date: record.data,
          amount,
          type: 'ENTRADA',
          payment_method: paymentMethod,
          account_id: accountId,
          category_id: CATEGORY_RECEBIMENTO_CLIENTES,
          unit_id: record.unitId,
          description,
          status: 'APROVADO',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          created_by: user.id,
        };
      });

      // Inserir transações em lote (para uso contábil)
      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (txError) {
        throw txError;
      }

      /**
       * REGRA DE NEGÓCIO CRÍTICA:
       * Também criar registros em lis_closure_items para cada código importado.
       * Isso disponibiliza os códigos para seleção em "Fechar Envelope".
       * 
       * - cash_component: valor em dinheiro (se paymentMethod = DINHEIRO)
       * - receivable_component: valor a receber (cartão, convênio, etc.)
       * - envelope_id: NULL (ainda não está em nenhum envelope)
       * - payment_status: 'PENDENTE' (ainda não fechado em envelope)
       */
      const lisClosureItems = selectedRecords.map((record) => {
        const originalIndex = parseResult?.records.indexOf(record);
        const resolution = originalIndex !== undefined ? resolvedRecords.get(originalIndex) : undefined;
        
        const amount = resolution ? resolution.amount : record.valorPago;
        const paymentMethod = resolution ? resolution.paymentMethod : record.paymentMethod;
        
        // Determinar componente de caixa vs recebível
        // CRÍTICO: DINHEIRO, PIX e CARTAO geram caixa no dia (são pagos na recepção)
        // Convênios, boletos, transferências são recebíveis (não geram caixa imediato)
        const isPaymentAtReception = ['DINHEIRO', 'PIX', 'CARTAO'].includes(paymentMethod);
        const cashComponent = isPaymentAtReception ? amount : 0;
        const receivableComponent = isPaymentAtReception ? 0 : amount;

        return {
          lis_code: record.codigo,
          date: record.data,
          patient_name: record.paciente,
          convenio: record.convenio,
          payment_method: paymentMethod,
          amount: amount,
          gross_amount: record.valorBruto,
          net_amount: record.valorLiquido || amount,
          cash_component: cashComponent,
          receivable_component: receivableComponent,
          card_fee_percent: record.cardFeePercent || null,
          card_fee_value: record.cardFeeValue || null,
          discount_percent: record.percentualDesconto || null,
          discount_value: record.valorDesconto || null,
          discount_reason: record.discountReason || null,
          discount_approved_by: record.discountApprovedBy || null,
          discount_approved_at: record.discountApprovedAt || null,
          discount_approval_channel: record.discountApprovalChannel || null,
          unit_id: record.unitId,
          envelope_id: null, // CRÍTICO: Fica NULL até ser fechado em envelope
          payment_status: 'PENDENTE',
          status: 'importado',
          closure_id: null, // Não depende mais de closure
        };
      });

      // Inserir/atualizar em lis_closure_items (para fluxo de envelopes)
      // Usa upsert com índice único (unit_id, date, lis_code) para evitar duplicados
      const { error: lisError } = await supabase
        .from('lis_closure_items')
        .upsert(lisClosureItems, {
          onConflict: 'unit_id,date,lis_code',
          ignoreDuplicates: true
        });

      if (lisError) {
        console.warn('Erro ao criar itens LIS para envelope:', lisError);
        // Não falhar a importação por isso, apenas logar
      }

      // Registrar importação
      const { error: importError } = await supabase
        .from('imports')
        .insert({
          file_name: fileName,
          period_start: parseResult.periodStart,
          period_end: parseResult.periodEnd,
          total_records: parseResult.totalRecords,
          imported_records: selectedIds.size,
          skipped_records: parseResult.totalRecords - selectedIds.size,
          imported_by: user.id,
          unit_id: selectedRecords[0]?.unitId || null,
        });

      if (importError) {
        console.warn('Erro ao registrar importação:', importError);
      }

      notifySuccess('Importação concluída', `${selectedIds.size} transações importadas. Códigos em dinheiro disponíveis para envelope.`);

      navigate('/transactions');
    } catch (error) {
      console.error('Erro na importação:', error);
      notifyError('Erro na importação', 'Ocorreu um erro ao importar as transações. Tente novamente.');
    } finally {
      setIsImporting(false);
    }
  };

  const getRowClassName = (record: LisRecord, isResolved?: boolean) => {
    if (record.isDuplicate) return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
    if (record.error) return 'bg-destructive/10 text-destructive';
    // Pending financial record
    if (requiresResolution(record)) {
      if (isResolved) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      return 'bg-destructive/10 text-destructive';
    }
    if (record.valorPago <= 0) return 'bg-muted text-muted-foreground';
    return '';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Movimento</h1>
          <p className="text-muted-foreground">
            Importe relatórios do LIS para disponibilizar códigos para fechamento de envelope
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Selecione o relatório de Movimento Diário Detalhado exportado do LIS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {fileName || 'Selecionar arquivo XLS...'}
              </Button>
              {parseResult && (
                <div className="text-sm text-muted-foreground">
                  Período: {parseResult.periodStart} a {parseResult.periodEnd}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parse Logs */}
        <ParseLogViewer
          logs={parseLogs}
          isExpanded={showLogs}
          onToggleExpand={() => setShowLogs(!showLogs)}
          fileName={fileName}
        />

        {/* Results */}
        {parseResult && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{parseResult.totalRecords}</div>
                  <p className="text-xs text-muted-foreground">Total de registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{parseResult.validRecords}</div>
                  <p className="text-xs text-muted-foreground">Válidos para importar</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-600">{parseResult.duplicateRecords}</div>
                  <p className="text-xs text-muted-foreground">Duplicatas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">{parseResult.invalidRecords}</div>
                  <p className="text-xs text-muted-foreground">Ignorados/Erros</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totalSelectedValue)}</div>
                  <p className="text-xs text-muted-foreground">Valor selecionado</p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === parseResult.records.filter(r => !r.error && r.valorPago > 0 && !r.isDuplicate).length && selectedIds.size > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm">Selecionar todos válidos</span>
              </div>
              <Button
                onClick={handleImport}
                disabled={isImporting || selectedIds.size === 0}
                className="w-full sm:w-auto"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4 mr-2" />
                )}
                Importar {selectedIds.size} transações
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50" />
                <span>Com pagamento (válido)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/50" />
                <span>Pendente financeiro</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/50" />
                <span>Resolvido</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/50" />
                <span>Duplicata</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted border" />
                <span>Ignorado</span>
              </div>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Pag.</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.records.map((record, index) => {
                        const isSelected = selectedIds.has(index);
                        const isPending = requiresResolution(record);
                        const isResolved = isRecordResolved(index);
                        const resolution = resolvedRecords.get(index);
                        
                        // Disable if: error, duplicate, or (value is 0 AND not a pending record)
                        const isDisabled = !!record.error || record.isDuplicate || 
                          (record.valorPago <= 0 && !isPending);

                        return (
                          <TableRow
                            key={index}
                            className={cn(
                              getRowClassName(record, isResolved),
                              isSelected && !isDisabled && 'bg-primary/5',
                              isPending && !isResolved && 'cursor-pointer hover:bg-destructive/5'
                            )}
                            onClick={isPending && !isResolved ? () => handleRecordClick(index, record) : undefined}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {isPending && !isResolved ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-6 h-6 rounded bg-destructive/20 flex items-center justify-center cursor-pointer hover:bg-destructive/30"
                                           onClick={() => handleRecordClick(index, record)}>
                                        <AlertTriangle className="h-4 w-4 text-destructive" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Clique para resolver a pendência
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleRecord(index)}
                                  disabled={isDisabled}
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.data}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.codigo}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {record.unidade || record.unidadeCodigo || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={record.paciente}>
                              {record.paciente}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={record.isParticular ? 'default' : 'secondary'}
                                className={cn(
                                  'text-xs',
                                  record.isParticular && 'bg-green-600'
                                )}
                              >
                                {record.convenio || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {isResolved && resolution ? (
                                <span className="text-blue-600 font-semibold">
                                  {formatCurrency(resolution.amount)}
                                </span>
                              ) : (
                                formatCurrency(record.valorPago)
                              )}
                            </TableCell>
                            <TableCell>
                              {isResolved && resolution ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className="text-blue-600">
                                        {getPaymentMethodIcon(resolution.paymentMethod)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {resolution.justification}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span title={record.formaPagamento}>
                                  {getPaymentMethodIcon(record.paymentMethod)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.isDuplicate ? (
                                <Badge className="text-xs bg-orange-600">
                                  <Copy className="h-3 w-3 mr-1" />
                                  Duplicata
                                </Badge>
                              ) : record.error ? (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              ) : isPending && !isResolved ? (
                                <Badge variant="destructive" className="text-xs cursor-pointer"
                                       onClick={() => handleRecordClick(index, record)}>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Pendente
                                </Badge>
                              ) : isResolved ? (
                                <Badge className="text-xs bg-blue-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Resolvido
                                </Badge>
                              ) : record.valorPago <= 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  Ignorado
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  OK
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      {/* Financial Resolution Modal */}
      <FinancialResolutionModal
        record={resolutionModal.record}
        open={resolutionModal.open}
        onClose={() => setResolutionModal({ open: false, recordIndex: null, record: null })}
        onResolve={handleResolution}
      />
    </AppLayout>
  );
}
