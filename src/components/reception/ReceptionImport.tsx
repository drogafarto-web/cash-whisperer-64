import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, CheckCircle2, Loader2, FileSpreadsheet, AlertTriangle, Ban, Layers, Eye } from 'lucide-react';
import { notifySuccess, notifyError, notifyWarning } from '@/lib/notify';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseLisXls, ParseResult, LisRecord } from '@/utils/lisImport';
import { format } from 'date-fns';
import { ImportPreviewModal } from './ImportPreviewModal';

// ID da categoria "Recebimento de Clientes" 
const CATEGORY_RECEBIMENTO_CLIENTES = '7ee0b99b-92a7-4e8f-bd71-337dbf0baf7e';

interface ReceptionImportProps {
  onBack: () => void;
  unitId: string | null;
}

// Tipo para registro consolidado com campos extras
interface ConsolidatedRecord extends LisRecord {
  consolidatedCount: number;
  consolidatedCashComponent?: number;
  consolidatedReceivableComponent?: number;
  consolidatedPaymentMethod?: string;
  // Campos de auditoria para duplicados (sobrescrevem LisRecord)
  originalImportedAt?: string;
  originalImportedBy?: string;
}

/**
 * Consolida registros duplicados DENTRO do mesmo arquivo
 */
function consolidateInFileRecords(records: LisRecord[], defaultUnitId: string | null): ConsolidatedRecord[] {
  const groupedMap = new Map<string, LisRecord[]>();
  
  for (const record of records) {
    const key = `${record.unitId || defaultUnitId}|${record.data}|${record.codigo}`;
    const group = groupedMap.get(key) || [];
    group.push(record);
    groupedMap.set(key, group);
  }
  
  const consolidated: ConsolidatedRecord[] = [];
  
  for (const [_key, group] of groupedMap) {
    if (group.length === 1) {
      consolidated.push({ ...group[0], consolidatedCount: 1 });
    } else {
      const first = group[0];
      const valorPago = group.reduce((sum, r) => sum + (r.valorPago || 0), 0);
      const valorBruto = group.reduce((sum, r) => sum + (r.valorBruto || 0), 0);
      const valorDesconto = group.reduce((sum, r) => sum + (r.valorDesconto || 0), 0);
      const valorAcrescimo = group.reduce((sum, r) => sum + (r.valorAcrescimo || 0), 0);
      
      const paymentMethods = [...new Set(group.map(r => r.paymentMethod))];
      let consolidatedPaymentMethod = first.paymentMethod as string;
      let consolidatedCashComponent = 0;
      let consolidatedReceivableComponent = 0;
      
      if (paymentMethods.length > 1) {
        consolidatedPaymentMethod = 'MISTO';
        consolidatedCashComponent = group
          .filter(r => r.paymentMethod === 'DINHEIRO')
          .reduce((sum, r) => sum + (r.valorPago || 0), 0);
        consolidatedReceivableComponent = group
          .filter(r => r.paymentMethod !== 'DINHEIRO')
          .reduce((sum, r) => sum + (r.valorPago || 0), 0);
      } else {
        consolidatedCashComponent = first.paymentMethod === 'DINHEIRO' ? valorPago : 0;
        consolidatedReceivableComponent = first.paymentMethod !== 'DINHEIRO' ? valorPago : 0;
      }
      
      consolidated.push({
        ...first,
        valorPago,
        valorBruto,
        valorDesconto,
        valorAcrescimo,
        consolidatedPaymentMethod,
        consolidatedCashComponent,
        consolidatedReceivableComponent,
        consolidatedCount: group.length,
      });
    }
  }
  
  return consolidated;
}

export function ReceptionImport({ onBack, unitId }: ReceptionImportProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [unitAccounts, setUnitAccounts] = useState<Record<string, string>>({});
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [consolidatedInFileCount, setConsolidatedInFileCount] = useState(0);
  const [recordsToImport, setRecordsToImport] = useState<ConsolidatedRecord[]>([]);
  const [recordsIgnored, setRecordsIgnored] = useState<ConsolidatedRecord[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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
      if (Object.keys(mapping).length === 0 && data.length > 0) {
        const fallbackAccount = data.find(a => !a.unit_id) || data[0];
        if (fallbackAccount) {
          mapping['__fallback__'] = fallbackAccount.id;
        }
      }
      setUnitAccounts(mapping);
      return mapping;
    }
    return {};
  };

  // Verificar duplicatas e buscar metadados de auditoria
  const checkDuplicatesInDb = async (records: ConsolidatedRecord[]): Promise<{ toImport: ConsolidatedRecord[], ignored: ConsolidatedRecord[] }> => {
    if (records.length === 0) return { toImport: [], ignored: [] };

    const dates = [...new Set(records.map(r => r.data))];
    const codes = [...new Set(records.map(r => r.codigo))];

    // Buscar registros existentes COM metadados de auditoria
    const { data: existingItems } = await supabase
      .from('lis_closure_items')
      .select('lis_code, date, unit_id, created_at')
      .in('date', dates)
      .in('lis_code', codes);

    // Mapear duplicatas com metadados
    const existingMap = new Map(
      (existingItems || []).map(item => [
        `${item.unit_id || unitId}|${item.date}|${item.lis_code}`,
        { createdAt: item.created_at }
      ])
    );

    const toImport: ConsolidatedRecord[] = [];
    const ignored: ConsolidatedRecord[] = [];

    for (const record of records) {
      const key = `${record.unitId || unitId}|${record.data}|${record.codigo}`;
      const existing = existingMap.get(key);
      
      if (existing) {
        ignored.push({
          ...record,
          isDuplicate: true,
          originalImportedAt: existing.createdAt || undefined,
          originalImportedBy: 'Importação anterior',
        });
      } else {
        toImport.push(record);
      }
    }

    return { toImport, ignored };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      notifyError('Arquivo inválido', 'Por favor, selecione um arquivo XLS ou XLSX.');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);
    setDuplicateCount(0);
    setConsolidatedInFileCount(0);
    setRecordsToImport([]);

    try {
      await loadUnitAccounts();
      const buffer = await file.arrayBuffer();
      const result = parseLisXls(buffer);
      
      // 1. Filtrar registros válidos
      const validRecords = result.records.filter(r => !r.error && r.valorPago > 0);
      
      // 2. NOVA ETAPA: Consolidar duplicatas DENTRO do arquivo
      const consolidatedRecords = consolidateInFileRecords(validRecords, unitId);
      const inFileConsolidatedCount = validRecords.length - consolidatedRecords.length;
      setConsolidatedInFileCount(inFileConsolidatedCount);
      
      // 3. Verificar duplicatas CONTRA O BANCO
      const { toImport, ignored } = await checkDuplicatesInDb(consolidatedRecords);
      
      setRecordsToImport(toImport);
      setRecordsIgnored(ignored);
      setDuplicateCount(ignored.length);
      setParseResult({
        ...result,
        validRecords: toImport.length,
      });
      
      const newRecords = toImport;
      
      // Feedback ao usuário
      if (inFileConsolidatedCount > 0) {
        console.log(`Consolidação: ${inFileConsolidatedCount} linhas duplicadas no arquivo foram mescladas.`);
      }
      
      if (ignored.length > 0 && newRecords.length === 0) {
        notifyWarning('Todos duplicados', `Todos os registros já foram importados anteriormente.`);
      } else if (ignored.length > 0 || inFileConsolidatedCount > 0) {
        let msg = '';
        if (inFileConsolidatedCount > 0) {
          msg += `${inFileConsolidatedCount} linhas repetidas consolidadas. `;
        }
        if (ignored.length > 0) {
          msg += `${ignored.length} já importados (ignorados). `;
        }
        msg += `${newRecords.length} novos para importar.`;
        notifyWarning('Duplicatas tratadas', msg);
      } else if (newRecords.length > 0) {
        notifySuccess('Arquivo processado', `${newRecords.length} registros prontos para importar.`);
      } else {
        notifyError('Sem registros', 'Nenhum registro válido encontrado no arquivo.');
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      notifyError('Erro ao processar', 'Não foi possível ler o arquivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!user || !parseResult) return;

    // Usar registros já consolidados e verificados
    if (recordsToImport.length === 0) {
      notifyWarning('Nada a importar', 'Todos os registros já foram importados anteriormente.');
      return;
    }

    setIsImporting(true);

    try {
      const accounts = Object.keys(unitAccounts).length > 0 ? unitAccounts : await loadUnitAccounts();
      
      // PRIMEIRO: Criar registros em lis_closure_items (tem constraint única)
      const lisClosureItems = recordsToImport.map((record) => {
        // Usar valores consolidados se disponíveis, senão calcular
        const cashValue = record.consolidatedCashComponent ?? (record.paymentMethod === 'DINHEIRO' ? record.valorPago : 0);
        const receivableValue = record.consolidatedReceivableComponent ?? (record.paymentMethod !== 'DINHEIRO' ? record.valorPago : 0);
        const paymentMethodStr = record.consolidatedPaymentMethod ?? record.paymentMethod;

        return {
          lis_code: record.codigo,
          date: record.data,
          amount: record.valorPago,
          payment_method: paymentMethodStr,
          patient_name: record.paciente,
          convenio: record.convenio,
          cash_component: cashValue,
          receivable_component: receivableValue,
          unit_id: record.unitId || unitId,
          payment_status: 'PENDENTE',
          status: 'pending',
          gross_amount: record.valorBruto,
          net_amount: record.valorPago,
        };
      });

      // Usa upsert com ignoreDuplicates para simplesmente ignorar códigos duplicados
      const { error: lisError } = await supabase
        .from('lis_closure_items')
        .upsert(lisClosureItems, {
          onConflict: 'unit_id,date,lis_code',
          ignoreDuplicates: true
        });

      if (lisError) {
        console.error('Erro ao inserir lis_closure_items:', lisError);
        throw new Error('Erro ao inserir itens de fechamento.');
      }

      // SEGUNDO: Criar transactions (após sucesso do lis_closure_items)
      const transactions = recordsToImport.map((record) => {
        let accountId = record.unitId ? accounts[record.unitId] : null;
        if (!accountId) {
          accountId = accounts['__fallback__'] || Object.values(accounts)[0];
        }

        const desc = record.consolidatedCount > 1 
          ? `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio} (${record.consolidatedCount} lançamentos)`
          : `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio}`;

        return {
          date: record.data,
          amount: record.valorPago,
          type: 'ENTRADA',
          payment_method: record.paymentMethod,
          account_id: accountId,
          category_id: CATEGORY_RECEBIMENTO_CLIENTES,
          unit_id: record.unitId || unitId,
          description: desc,
          status: 'APROVADO',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          created_by: user.id,
        };
      });

      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (txError) throw txError;

      setImportedCount(recordsToImport.length);
      setImportSuccess(true);
      notifySuccess('Importação concluída', `${recordsToImport.length} registros importados com sucesso!`);
    } catch (error) {
      console.error('Erro na importação:', error);
      const errorMsg = error instanceof Error ? error.message : 'Não foi possível importar os dados.';
      
      // Detectar erro de data e mostrar mensagem mais clara
      if (errorMsg.includes('date/time') || errorMsg.includes('out of range')) {
        notifyError('Erro de data', 'Uma ou mais datas no arquivo estão em formato inválido. Verifique se as datas estão no formato DD/MM/AAAA.');
      } else {
        notifyError('Erro na importação', errorMsg);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Tela de sucesso
  if (importSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <CheckCircle2 className="h-24 w-24 text-green-500" />
        <h1 className="text-3xl font-bold">Movimento Importado!</h1>
        <p className="text-xl text-muted-foreground">{importedCount} registros processados</p>
        {duplicateCount > 0 && (
          <p className="text-muted-foreground">{duplicateCount} registros duplicados foram ignorados</p>
        )}
        <Button size="lg" className="h-14 text-lg px-8" onClick={onBack}>
          Voltar ao Painel Recepção
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Painel
      </Button>

      <Card className="max-w-xl mx-auto">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <FileSpreadsheet className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold">Importar Movimento do Dia</h2>
            <p className="text-muted-foreground mt-2">
              Selecione o arquivo de Movimento do Dia (LIS / atendimentos)
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data do Movimento</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-12 text-lg"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="outline"
              className="w-full h-24 border-dashed border-2 flex flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <Upload className="h-8 w-8" />
                  <span>{fileName || 'Clique para selecionar arquivo XLS/XLSX'}</span>
                </>
              )}
            </Button>

            {parseResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                {parseResult.validRecords > 0 ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">
                      {parseResult.validRecords} novos registros para importar
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">
                      Nenhum registro novo para importar
                    </span>
                  </div>
                )}
                
                {consolidatedInFileCount > 0 && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Layers className="h-5 w-5" />
                    <span className="text-sm">
                      {consolidatedInFileCount} linhas repetidas consolidadas automaticamente
                    </span>
                  </div>
                )}

                {duplicateCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm">
                      {duplicateCount} registros já importados (serão ignorados)
                    </span>
                  </div>
                )}
                
                {parseResult.invalidRecords > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {parseResult.invalidRecords} registros com erro/ignorados
                  </p>
                )}
              </div>
            )}

            <Button
              size="lg"
              className="w-full h-14 text-lg gap-2"
              onClick={() => setShowPreviewModal(true)}
              disabled={!parseResult || parseResult.validRecords === 0 || isImporting}
            >
              <Eye className="h-5 w-5" />
              Revisar e Importar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Pré-Visualização */}
      <ImportPreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={() => {
          setShowPreviewModal(false);
          handleImport();
        }}
        recordsToImport={recordsToImport.map(r => ({
          codigo: r.codigo,
          paciente: r.paciente,
          convenio: r.convenio,
          valorPago: r.valorPago,
          paymentMethod: r.consolidatedPaymentMethod || r.paymentMethod,
          unitId: r.unitId || unitId || '',
          data: r.data,
          consolidatedCount: r.consolidatedCount,
        }))}
        recordsIgnored={recordsIgnored.map(r => ({
          codigo: r.codigo,
          paciente: r.paciente,
          convenio: r.convenio,
          valorPago: r.valorPago,
          paymentMethod: r.paymentMethod,
          unitId: r.unitId || unitId || '',
          data: r.data,
          isDuplicate: true,
          originalImportedAt: r.originalImportedAt,
          originalImportedBy: r.originalImportedBy,
        }))}
        consolidatedCount={consolidatedInFileCount}
        isImporting={isImporting}
      />
    </div>
  );
}
