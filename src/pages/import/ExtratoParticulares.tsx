import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import {
  parseLisXls,
  parseLisCsv,
  LisRecord,
  ParseResult,
  CardFeeConfig,
  getPaymentMethodIcon,
  formatCurrency,
  formatPercent,
  extractLisCodeFromDescription,
} from '@/utils/lisImport';
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
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_RECEBIMENTO_CLIENTES = '7ee0b99b-92a7-4e8f-bd71-337dbf0baf7e';

const APPROVAL_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'email', label: 'E-mail' },
  { value: 'outro', label: 'Outro' },
];

export default function ExtratoParticulares() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [records, setRecords] = useState<LisRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [unitAccounts, setUnitAccounts] = useState<Record<string, string>>({});

  // Carregar configurações de taxa de cartão
  const { data: cardFees = [] } = useQuery({
    queryKey: ['cardFees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('card_fee_config')
        .select('id, name, fee_percent')
        .eq('active', true);
      return (data || []) as CardFeeConfig[];
    },
  });

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
    }
  };

  const checkDuplicates = async (
    records: LisRecord[],
    periodStart: string | null,
    periodEnd: string | null
  ): Promise<LisRecord[]> => {
    if (!periodStart || !periodEnd) return records;

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('description, date, lis_protocol_id')
      .or(`description.like.[LIS %,lis_protocol_id.neq.null`)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (!existingTx || existingTx.length === 0) return records;

    const existingKeys = new Set<string>();
    existingTx.forEach(t => {
      if (t.lis_protocol_id) {
        existingKeys.add(`${t.date}_${t.lis_protocol_id}`);
      } else {
        const lisCode = extractLisCodeFromDescription(t.description || '');
        if (lisCode) {
          existingKeys.add(`${t.date}_${lisCode}`);
        }
      }
    });

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

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isXls = file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx');

    if (!isCsv && !isXls) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo CSV, XLS ou XLSX.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      await loadUnitAccounts();

      let result: ParseResult;

      if (isCsv) {
        const text = await file.text();
        result = parseLisCsv(text, cardFees);
      } else {
        const buffer = await file.arrayBuffer();
        result = parseLisXls(buffer, cardFees);
      }

      const recordsWithDuplicates = await checkDuplicates(
        result.records,
        result.periodStart,
        result.periodEnd
      );
      
      const duplicateCount = recordsWithDuplicates.filter(r => r.isDuplicate).length;

      const updatedResult: ParseResult = {
        ...result,
        records: recordsWithDuplicates,
        duplicateRecords: duplicateCount,
        validRecords: recordsWithDuplicates.filter(r => !r.error && !r.isDuplicate).length,
      };

      setParseResult(updatedResult);
      setRecords(recordsWithDuplicates);

      const preSelected = new Set<number>();
      updatedResult.records.forEach((record, index) => {
        if (!record.error && !record.isDuplicate) {
          preSelected.add(index);
        }
      });
      setSelectedIds(preSelected);

      toast({
        title: 'Arquivo processado',
        description: `${result.totalRecords} registros encontrados, ${updatedResult.validRecords} válidos.`,
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

  const updateRecord = (index: number, updates: Partial<LisRecord>) => {
    setRecords(prev => {
      const newRecords = [...prev];
      newRecords[index] = { ...newRecords[index], ...updates };
      return newRecords;
    });
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
    const validCount = records.filter(r => !r.error && !r.isDuplicate).length;
    if (selectedIds.size === validCount) {
      setSelectedIds(new Set());
    } else {
      const allValid = new Set<number>();
      records.forEach((record, index) => {
        if (!record.error && !record.isDuplicate) {
          allValid.add(index);
        }
      });
      setSelectedIds(allValid);
    }
  };

  const selectedRecords = useMemo(() => {
    return records.filter((_, i) => selectedIds.has(i));
  }, [records, selectedIds]);

  const totalSelectedValue = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + r.valorLiquido, 0);
  }, [selectedRecords]);

  const totalCardFees = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + r.cardFeeValue, 0);
  }, [selectedRecords]);

  // Verificar se há pendências de justificativa
  const pendingJustifications = useMemo(() => {
    return selectedRecords.filter(r => {
      if (r.discountLevel === 'medium' && !r.discountReason) return true;
      if (r.discountLevel === 'high' && (!r.discountReason || !r.discountApprovedAt || !r.discountApprovalChannel)) return true;
      return false;
    });
  }, [selectedRecords]);

  const handleImport = async () => {
    if (!user || selectedIds.size === 0) return;

    if (pendingJustifications.length > 0) {
      toast({
        title: 'Justificativas pendentes',
        description: `${pendingJustifications.length} registro(s) precisam de justificativa antes de importar.`,
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const transactions = selectedRecords.map(record => {
        let accountId = record.unitId ? unitAccounts[record.unitId] : null;
        if (!accountId) {
          accountId = unitAccounts['__fallback__'] || Object.values(unitAccounts)[0];
        }

        return {
          date: record.data,
          amount: record.valorLiquido,
          gross_amount: record.valorPago,
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
          lis_protocol_id: record.codigo,
          discount_value: record.valorDesconto,
          discount_percent: record.percentualDesconto * 100,
          discount_reason: record.discountReason || null,
          discount_approved_by: record.discountApprovedBy || null,
          discount_approved_at: record.discountApprovedAt || null,
          discount_approval_channel: record.discountApprovalChannel || null,
          card_fee_percent: record.cardFeePercent,
          card_fee_value: record.cardFeeValue,
        };
      });

      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (txError) throw txError;

      const { error: importError } = await supabase
        .from('imports')
        .insert({
          file_name: fileName,
          period_start: parseResult?.periodStart,
          period_end: parseResult?.periodEnd,
          total_records: parseResult?.totalRecords || 0,
          imported_records: selectedIds.size,
          skipped_records: (parseResult?.totalRecords || 0) - selectedIds.size,
          imported_by: user.id,
          unit_id: selectedRecords[0]?.unitId || null,
        });

      if (importError) console.warn('Erro ao registrar importação:', importError);

      toast({
        title: 'Importação concluída',
        description: `${selectedIds.size} transações importadas com sucesso.`,
      });

      navigate('/transactions');
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro ao importar as transações.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getRowClassName = (record: LisRecord) => {
    if (record.isDuplicate) return 'bg-orange-500/20';
    if (record.error) return 'bg-destructive/10';
    if (record.discountLevel === 'high') return 'bg-red-500/10';
    if (record.discountLevel === 'medium') return 'bg-yellow-500/10';
    return '';
  };

  const getDiscountBadge = (record: LisRecord) => {
    if (record.percentualDesconto === 0) return null;
    
    const percent = formatPercent(record.percentualDesconto);
    
    if (record.discountLevel === 'high') {
      const needsFields = !record.discountReason || !record.discountApprovedAt || !record.discountApprovalChannel;
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          {percent}
          {needsFields && <AlertCircle className="h-3 w-3" />}
        </Badge>
      );
    }
    if (record.discountLevel === 'medium') {
      const needsReason = !record.discountReason;
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
          {percent}
          {needsReason && <AlertCircle className="h-3 w-3" />}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600">
        {percent}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Extrato de Particulares</h1>
          <p className="text-muted-foreground">
            Importe extratos do LIS com cálculo automático de taxa de cartão e controle de descontos
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
              Selecione o arquivo CSV ou XLS exportado do LIS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
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
                {fileName || 'Selecionar arquivo...'}
              </Button>
              {parseResult && (
                <div className="text-sm text-muted-foreground">
                  Período: {parseResult.periodStart} a {parseResult.periodEnd}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regras de Desconto */}
        <Card className="border-muted">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Regras de Justificativa de Desconto:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600">≤ 10%</Badge>
                    Sem necessidade de justificativa
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">10-30%</Badge>
                    Obrigatório informar motivo do desconto
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="destructive">&gt; 30%</Badge>
                    Obrigatório: motivo + data/hora + canal da autorização (Dr. Bruno)
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {records.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{records.length}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {records.filter(r => !r.error && !r.isDuplicate).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Válidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-600">
                    {records.filter(r => r.isDuplicate).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Duplicatas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">
                    {pendingJustifications.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Pend. Justif.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalSelectedValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">Valor Líquido</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {formatCurrency(totalCardFees)}
                  </div>
                  <p className="text-xs text-muted-foreground">Taxa Cartão</p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === records.filter(r => !r.error && !r.isDuplicate).length && selectedIds.size > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm">Selecionar todos válidos</span>
              </div>
              <Button
                onClick={handleImport}
                disabled={isImporting || selectedIds.size === 0 || pendingJustifications.length > 0}
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
                <span>Desconto ≤ 10%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50" />
                <span>Desconto 10-30%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50" />
                <span>Desconto &gt; 30%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/50" />
                <span>Duplicata</span>
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
                        <TableHead>Código</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">% Desc</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead>Pag.</TableHead>
                        <TableHead>Motivo Desconto</TableHead>
                        <TableHead>Autorização</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record, index) => {
                        const isSelected = selectedIds.has(index);
                        const isDisabled = !!record.error || record.isDuplicate;
                        const needsJustification = record.discountLevel !== 'none' && selectedIds.has(index);

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
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {record.data}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline">{record.unidadeCodigo || '?'}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>{record.unidade}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{record.codigo}</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={record.paciente}>
                              {record.paciente}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatCurrency(record.valorBruto)}
                            </TableCell>
                            <TableCell className="text-right">
                              {getDiscountBadge(record)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatCurrency(record.valorPago)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {record.cardFeeValue > 0 ? formatCurrency(record.cardFeeValue) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium">
                              {formatCurrency(record.valorLiquido)}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-lg">{getPaymentMethodIcon(record.paymentMethod)}</span>
                                </TooltipTrigger>
                                <TooltipContent>{record.formaPagamentoOriginal}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {needsJustification && record.discountLevel !== 'none' && (
                                <Input
                                  placeholder="Motivo..."
                                  value={record.discountReason || ''}
                                  onChange={e => updateRecord(index, { discountReason: e.target.value })}
                                  className="h-8 w-32 text-xs"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {needsJustification && record.discountLevel === 'high' && (
                                <div className="flex flex-col gap-1">
                                  <Input
                                    type="datetime-local"
                                    value={record.discountApprovedAt || ''}
                                    onChange={e => updateRecord(index, { 
                                      discountApprovedAt: e.target.value,
                                      discountApprovedBy: 'Dr. Bruno'
                                    })}
                                    className="h-8 w-40 text-xs"
                                  />
                                  <Select
                                    value={record.discountApprovalChannel || ''}
                                    onValueChange={v => updateRecord(index, { discountApprovalChannel: v })}
                                  >
                                    <SelectTrigger className="h-8 w-40 text-xs">
                                      <SelectValue placeholder="Canal..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {APPROVAL_CHANNELS.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.error ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>{record.error}</TooltipContent>
                                </Tooltip>
                              ) : record.isDuplicate ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>{record.duplicateReason}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
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
