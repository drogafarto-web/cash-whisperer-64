import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseLisXls, LisRecord, ParseResult, getPaymentMethodIcon, formatCurrency, extractLisCodeFromDescription } from '@/utils/lisImport';
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

// ID da categoria "Recebimento de Clientes" 
const CATEGORY_RECEBIMENTO_CLIENTES = '7ee0b99b-92a7-4e8f-bd71-337dbf0baf7e';

export default function DailyMovement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [unitAccounts, setUnitAccounts] = useState<Record<string, string>>({});

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
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo XLS ou XLSX.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      await loadUnitAccounts();

      const buffer = await file.arrayBuffer();
      const result = parseLisXls(buffer);

      // Verificar duplicatas
      const recordsWithDuplicates = await checkDuplicates(result.records, result.periodStart, result.periodEnd);
      const duplicateCount = recordsWithDuplicates.filter(r => r.isDuplicate).length;
      
      const updatedResult: ParseResult = {
        ...result,
        records: recordsWithDuplicates,
        duplicateRecords: duplicateCount,
        validRecords: recordsWithDuplicates.filter(r => !r.error && r.valorPago > 0 && !r.isDuplicate).length,
      };

      setParseResult(updatedResult);

      // Pré-selecionar apenas registros particulares válidos com valor > 0 e NÃO duplicatas
      const preSelected = new Set<number>();
      updatedResult.records.forEach((record, index) => {
        if (record.isParticular && !record.error && record.valorPago > 0 && !record.isDuplicate) {
          preSelected.add(index);
        }
      });
      setSelectedIds(preSelected);

      const duplicateMsg = duplicateCount > 0 ? ` ${duplicateCount} duplicatas detectadas.` : '';
      toast({
        title: 'Arquivo processado',
        description: `${result.totalRecords} registros encontrados, ${updatedResult.validRecords} válidos.${duplicateMsg}`,
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Não foi possível ler o arquivo. Verifique se é um relatório do LIS válido.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecord = (index: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (!parseResult) return;
    
    const validCount = parseResult.records.filter(r => !r.error && r.valorPago > 0 && !r.isDuplicate).length;
    if (selectedIds.size === validCount) {
      setSelectedIds(new Set());
    } else {
      const allValid = new Set<number>();
      parseResult.records.forEach((record, index) => {
        if (!record.error && record.valorPago > 0 && !record.isDuplicate) {
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
    return selectedRecords.reduce((sum, r) => sum + r.valorPago, 0);
  }, [selectedRecords]);

  const handleImport = async () => {
    if (!user || !parseResult || selectedIds.size === 0) return;

    setIsImporting(true);

    try {
      const transactions = selectedRecords.map(record => {
        // Encontrar conta de caixa para a unidade
        let accountId = record.unitId ? unitAccounts[record.unitId] : null;
        if (!accountId) {
          accountId = unitAccounts['__fallback__'] || Object.values(unitAccounts)[0];
        }

        return {
          date: record.data,
          amount: record.valorPago,
          type: 'ENTRADA',
          payment_method: record.paymentMethod,
          account_id: accountId,
          category_id: CATEGORY_RECEBIMENTO_CLIENTES,
          unit_id: record.unitId,
          description: `[LIS ${record.codigo}] ${record.paciente} - ${record.convenio}`,
          status: 'APROVADO',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          created_by: user.id,
        };
      });

      // Inserir transações em lote
      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (txError) {
        throw txError;
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

      toast({
        title: 'Importação concluída',
        description: `${selectedIds.size} transações importadas com sucesso.`,
      });

      navigate('/transactions');
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro ao importar as transações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getRowClassName = (record: LisRecord) => {
    if (record.isDuplicate) return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
    if (record.error) return 'bg-destructive/10 text-destructive';
    if (record.valorPago <= 0) return 'bg-muted text-muted-foreground';
    if (!record.isParticular) return 'bg-yellow-500/10';
    return '';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Movimento Diário</h1>
          <p className="text-muted-foreground">
            Importe relatórios do sistema LIS para criar transações automaticamente
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
                <span>Particular (recomendado)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50" />
                <span>Convênio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/50" />
                <span>Duplicata</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted border" />
                <span>Valor zero</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/50" />
                <span>Erro</span>
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
                        const isDisabled = !!record.error || record.valorPago <= 0 || record.isDuplicate;

                        return (
                          <TableRow
                            key={index}
                            className={cn(
                              getRowClassName(record),
                              isSelected && !isDisabled && 'bg-primary/5'
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRecord(index)}
                                disabled={isDisabled}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.data}
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
                              {formatCurrency(record.valorPago)}
                            </TableCell>
                            <TableCell>
                              <span title={record.formaPagamento}>
                                {getPaymentMethodIcon(record.paymentMethod)}
                              </span>
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
                              ) : record.valorPago <= 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  Ignorado
                                </Badge>
                              ) : record.isParticular ? (
                                <Badge className="text-xs bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Convênio
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
    </AppLayout>
  );
}
