import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, CheckCircle2, Loader2, FileSpreadsheet, AlertTriangle, Ban } from 'lucide-react';
import { notifySuccess, notifyError, notifyWarning } from '@/lib/notify';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseLisXls, ParseResult, LisRecord } from '@/utils/lisImport';
import { format } from 'date-fns';

// ID da categoria "Recebimento de Clientes" 
const CATEGORY_RECEBIMENTO_CLIENTES = '7ee0b99b-92a7-4e8f-bd71-337dbf0baf7e';

interface ReceptionImportProps {
  onBack: () => void;
  unitId: string | null;
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
  const [recordsWithDuplicates, setRecordsWithDuplicates] = useState<LisRecord[]>([]);

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

  // Verificar duplicatas em lis_closure_items
  const checkDuplicates = async (records: LisRecord[]): Promise<LisRecord[]> => {
    if (records.length === 0) return [];

    // Extrair datas e códigos únicos
    const dates = [...new Set(records.map(r => r.data))];
    const codes = [...new Set(records.map(r => r.codigo))];

    // Buscar registros existentes
    const { data: existingItems } = await supabase
      .from('lis_closure_items')
      .select('lis_code, date, unit_id')
      .in('date', dates)
      .in('lis_code', codes);

    // Criar set de chaves existentes (unit_id + date + lis_code)
    const existingKeys = new Set(
      (existingItems || []).map(item => 
        `${item.unit_id || unitId}|${item.date}|${item.lis_code}`
      )
    );

    // Marcar registros como duplicados
    return records.map(record => ({
      ...record,
      isDuplicate: existingKeys.has(`${record.unitId || unitId}|${record.data}|${record.codigo}`)
    }));
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
    setRecordsWithDuplicates([]);

    try {
      await loadUnitAccounts();
      const buffer = await file.arrayBuffer();
      const result = parseLisXls(buffer);
      
      // Verificar duplicatas
      const validRecords = result.records.filter(r => !r.error && r.valorPago > 0);
      const recordsChecked = await checkDuplicates(validRecords);
      
      const duplicates = recordsChecked.filter(r => r.isDuplicate).length;
      const newRecords = recordsChecked.filter(r => !r.isDuplicate).length;
      
      setRecordsWithDuplicates(recordsChecked);
      setDuplicateCount(duplicates);
      setParseResult({
        ...result,
        validRecords: newRecords, // Apenas registros novos
      });
      
      if (duplicates > 0 && newRecords === 0) {
        notifyWarning('Todos duplicados', `Todos os ${duplicates} registros já foram importados anteriormente.`);
      } else if (duplicates > 0) {
        notifyWarning('Duplicatas encontradas', `${duplicates} registros já importados serão ignorados. ${newRecords} novos serão importados.`);
      } else if (newRecords > 0) {
        notifySuccess('Arquivo processado', `${newRecords} registros válidos encontrados.`);
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

    // Filtrar apenas registros novos (não duplicados)
    const newRecords = recordsWithDuplicates.filter(r => !r.isDuplicate && !r.error && r.valorPago > 0);
    
    if (newRecords.length === 0) {
      notifyWarning('Nada a importar', 'Todos os registros já foram importados anteriormente.');
      return;
    }

    setIsImporting(true);

    try {
      const accounts = Object.keys(unitAccounts).length > 0 ? unitAccounts : await loadUnitAccounts();
      
      // PRIMEIRO: Criar registros em lis_closure_items (tem constraint única)
      const lisClosureItems = newRecords.map((record) => {
        const cashValue = record.paymentMethod === 'DINHEIRO' ? record.valorPago : 0;
        const receivableValue = record.paymentMethod !== 'DINHEIRO' ? record.valorPago : 0;

        return {
          lis_code: record.codigo,
          date: record.data,
          amount: record.valorPago,
          payment_method: record.paymentMethod,
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

      const { error: lisError } = await supabase
        .from('lis_closure_items')
        .insert(lisClosureItems);

      if (lisError) {
        // Se falhar aqui, nenhuma transaction foi criada ainda
        console.error('Erro ao inserir lis_closure_items:', lisError);
        throw new Error('Erro ao inserir itens de fechamento. Verifique se há duplicatas.');
      }

      // SEGUNDO: Criar transactions (após sucesso do lis_closure_items)
      const transactions = newRecords.map((record) => {
        let accountId = record.unitId ? accounts[record.unitId] : null;
        if (!accountId) {
          accountId = accounts['__fallback__'] || Object.values(accounts)[0];
        }

        return {
          date: record.data,
          amount: record.valorPago,
          type: 'ENTRADA',
          payment_method: record.paymentMethod,
          account_id: accountId,
          category_id: CATEGORY_RECEBIMENTO_CLIENTES,
          unit_id: record.unitId || unitId,
          description: `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio}`,
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

      setImportedCount(newRecords.length);
      setImportSuccess(true);
      notifySuccess('Importação concluída', `${newRecords.length} registros importados com sucesso!`);
    } catch (error) {
      console.error('Erro na importação:', error);
      notifyError('Erro na importação', error instanceof Error ? error.message : 'Não foi possível importar os dados.');
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
              className="w-full h-14 text-lg"
              onClick={handleImport}
              disabled={!parseResult || parseResult.validRecords === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar Movimento'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
