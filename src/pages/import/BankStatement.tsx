import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UnitSelector } from '@/components/UnitSelector';
import { PayableMatchingSuggestions } from '@/components/payables/PayableMatchingSuggestions';
import { supabase } from '@/integrations/supabase/client';
import { Partner, Category, Account, Unit } from '@/types/database';
import { Payable } from '@/types/payables';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  BankStatementRecord,
  BankStatementParseResult,
  parseFile,
  enrichRecordsWithSuggestions,
  ParseProgressCallback,
} from '@/utils/bankStatementImport';

export default function BankStatementImport() {
  const navigate = useNavigate();
  const { user, isAdmin, unit: userUnit, isLoading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<string>('');
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [parseResult, setParseResult] = useState<BankStatementParseResult | null>(null);
  const [records, setRecords] = useState<BankStatementRecord[]>([]);
  const [pendingPayables, setPendingPayables] = useState<Payable[]>([]);
  const [showMatchingSuggestions, setShowMatchingSuggestions] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      if (!isAdmin && userUnit) {
        setSelectedUnitId(userUnit.id);
      }
      fetchData();
    }
  }, [user, userUnit, isAdmin]);

  // Update accounts when unit changes
  useEffect(() => {
    if (selectedUnitId) {
      setSelectedAccountId('');
    }
  }, [selectedUnitId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ data: partnerData }, { data: categoryData }, { data: accountData }, { data: unitData }] = await Promise.all([
        supabase.from('partners').select('*, default_category:categories(*)').eq('active', true),
        supabase.from('categories').select('*').eq('active', true),
        supabase.from('accounts').select('*, unit:units(*)').eq('active', true),
        supabase.from('units').select('*').order('name'),
      ]);

      setPartners((partnerData || []) as Partner[]);
      setCategories((categoryData || []) as Category[]);
      setAccounts((accountData || []) as Account[]);
      setUnits((unitData || []) as Unit[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pending payables for matching
  useEffect(() => {
    const fetchPendingPayables = async () => {
      const { data } = await supabase
        .from('payables')
        .select('*')
        .in('status', ['pendente', 'vencido', 'PENDENTE', 'VENCIDO'])
        .is('matched_transaction_id', null)
        .is('matched_bank_item_id', null);
      setPendingPayables((data || []) as Payable[]);
    };
    if (user) fetchPendingPayables();
  }, [user]);

  const filteredAccounts = useMemo(() => 
    selectedUnitId ? accounts.filter(a => a.unit_id === selectedUnitId) : accounts,
    [accounts, selectedUnitId]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseProgress('');
    
    const onProgress: ParseProgressCallback = (message, current, total) => {
      setParseProgress(message);
    };
    
    try {
      const result = await parseFile(file, onProgress);
      
      // Enrich with partner/category suggestions
      const enrichedRecords = enrichRecordsWithSuggestions(result.records, partners, categories);
      
      // Count matched records
      const matchedCount = enrichedRecords.filter(r => r.suggestedPartner).length;
      
      setParseResult({
        ...result,
        matchedRecords: matchedCount,
      });
      setRecords(enrichedRecords);
      
      toast.success(`${result.totalRecords} registros carregados, ${matchedCount} com sugestão automática`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar arquivo');
    } finally {
      setIsParsing(false);
      setParseProgress('');
      // Reset input
      e.target.value = '';
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setRecords(prev => prev.map(r => 
      r.id === recordId ? { ...r, isSelected: !r.isSelected } : r
    ));
  };

  const toggleAllRecords = (checked: boolean) => {
    setRecords(prev => prev.map(r => ({ ...r, isSelected: checked })));
  };

  const updateRecordPartner = (recordId: string, partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId) || null;
    const category = partner?.default_category_id 
      ? categories.find(c => c.id === partner.default_category_id) || null
      : null;
    
    // Check value divergence
    const record = records.find(r => r.id === recordId);
    let valueDivergence = null;
    if (partner?.expected_amount && record && Math.abs(record.amount - partner.expected_amount) > 0.01) {
      valueDivergence = {
        expected: partner.expected_amount,
        actual: record.amount,
        difference: record.amount - partner.expected_amount,
      };
    }
    
    setRecords(prev => prev.map(r => 
      r.id === recordId ? { 
        ...r, 
        suggestedPartner: partner, 
        suggestedCategory: category,
        valueDivergence,
        matchConfidence: partner ? 100 : 0 
      } : r
    ));
  };

  const updateRecordCategory = (recordId: string, categoryId: string) => {
    const category = categories.find(c => c.id === categoryId) || null;
    setRecords(prev => prev.map(r => 
      r.id === recordId ? { ...r, suggestedCategory: category } : r
    ));
  };

  const selectedRecords = useMemo(() => records.filter(r => r.isSelected), [records]);
  
  const summary = useMemo(() => {
    const selected = selectedRecords;
    const entradas = selected.filter(r => r.type === 'ENTRADA').reduce((sum, r) => sum + r.amount, 0);
    const saidas = selected.filter(r => r.type === 'SAIDA').reduce((sum, r) => sum + r.amount, 0);
    const withSuggestion = selected.filter(r => r.suggestedPartner).length;
    const withDivergence = selected.filter(r => r.valueDivergence).length;
    const withCategory = selected.filter(r => r.suggestedCategory).length;
    const withoutCategory = selected.length - withCategory;
    
    return { total: selected.length, entradas, saidas, withSuggestion, withDivergence, withCategory, withoutCategory };
  }, [selectedRecords]);

  const handleImport = async () => {
    if (!user || !selectedUnitId || !selectedAccountId) {
      toast.error('Selecione unidade e conta');
      return;
    }

    const toImport = selectedRecords.filter(r => r.suggestedCategory);
    const withoutCategory = selectedRecords.filter(r => !r.suggestedCategory);
    
    if (toImport.length === 0) {
      toast.error('Nenhuma transação com categoria definida. Defina a categoria para ao menos uma transação selecionada.');
      return;
    }

    // Warn about transactions that will be skipped
    if (withoutCategory.length > 0) {
      toast.warning(`${withoutCategory.length} transações sem categoria serão ignoradas`);
    }

    setIsImporting(true);
    try {
      const transactions = toImport.map(record => ({
        date: record.date,
        amount: record.amount,
        type: record.type,
        payment_method: 'TRANSFERENCIA',
        account_id: selectedAccountId,
        category_id: record.suggestedCategory!.id,
        partner_id: record.suggestedPartner?.id || null,
        description: record.description,
        unit_id: selectedUnitId,
        created_by: user.id,
        status: 'PENDENTE',
      }));

      const { error } = await supabase.from('transactions').insert(transactions);
      
      if (error) throw error;

      // Log import
      await supabase.from('imports').insert({
        file_name: `extrato_bancario_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`,
        imported_by: user.id,
        unit_id: selectedUnitId,
        total_records: records.length,
        imported_records: toImport.length,
        skipped_records: records.length - toImport.length,
        period_start: parseResult?.periodStart,
        period_end: parseResult?.periodEnd,
      });

      toast.success(`${toImport.length} transações importadas com sucesso!`);
      
      // Reset state
      setRecords([]);
      setParseResult(null);
    } catch (error) {
      console.error('Error importing transactions:', error);
      toast.error('Erro ao importar transações');
    } finally {
      setIsImporting(false);
    }
  };

  const getFilteredPartners = (type: 'ENTRADA' | 'SAIDA') => {
    return partners.filter(p => 
      (type === 'ENTRADA' && p.type === 'CLIENTE') ||
      (type === 'SAIDA' && p.type === 'FORNECEDOR')
    );
  };

  const getFilteredCategories = (type: 'ENTRADA' | 'SAIDA') => {
    return categories.filter(c => c.type === type);
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Importar Extrato Bancário</h1>
          <p className="text-sm text-muted-foreground">
            Importe extratos OFX, CSV ou PDF e classifique automaticamente as transações por parceiro e categoria.
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração</CardTitle>
            <CardDescription>Selecione a unidade e conta antes de importar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Unidade</label>
                {isAdmin ? (
                  <UnitSelector
                    value={selectedUnitId}
                    onChange={setSelectedUnitId}
                    placeholder="Selecione a unidade..."
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">{userUnit?.name || 'Sem unidade'}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta Bancária</label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={!selectedUnitId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedUnitId ? "Selecione unidade primeiro" : "Selecione a conta..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Arquivo OFX/CSV/PDF</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".ofx,.csv,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="bank-file-upload"
                    disabled={isParsing || !selectedUnitId || !selectedAccountId}
                  />
                  <label 
                    htmlFor="bank-file-upload" 
                    className={`flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isParsing || !selectedUnitId || !selectedAccountId 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:border-primary/50'
                    }`}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{parseProgress || 'Processando...'}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Selecionar arquivo</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payable Matching Suggestions */}
        {showMatchingSuggestions && pendingPayables.length > 0 && records.length > 0 && (
          <PayableMatchingSuggestions
            pendingPayables={pendingPayables}
            importedRecords={records.map(r => ({
              id: r.id,
              date: r.date,
              description: r.description,
              amount: r.amount,
              type: r.type.toLowerCase() as 'entrada' | 'saida',
            }))}
            onDismiss={() => setShowMatchingSuggestions(false)}
          />
        )}

        {/* Results */}
        {parseResult && records.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{summary.total}</p>
                      <p className="text-xs text-muted-foreground">Selecionadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-2xl font-bold text-success">+R$ {summary.entradas.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Entradas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold text-destructive">-R$ {summary.saidas.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Saídas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{summary.withSuggestion}</p>
                      <p className="text-xs text-muted-foreground">Com sugestão</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    <div>
                      <p className="text-2xl font-bold text-warning">{summary.withDivergence}</p>
                      <p className="text-xs text-muted-foreground">Valor divergente</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Recorrente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-muted-foreground">Sugestão automática</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span className="text-muted-foreground">Valor diferente do esperado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Sem sugestão</span>
              </div>
            </div>

            {/* Records Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={records.every(r => r.isSelected)}
                          onCheckedChange={(checked) => toggleAllRecords(!!checked)}
                        />
                      </TableHead>
                      <TableHead className="w-28">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-32 text-right">Valor</TableHead>
                      <TableHead className="w-48">Parceiro</TableHead>
                      <TableHead className="w-48">Categoria</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(record => {
                      const needsCategory = record.isSelected && !record.suggestedCategory;
                      return (
                      <TableRow 
                        key={record.id} 
                        className={`${!record.isSelected ? 'opacity-50' : ''} ${needsCategory ? 'bg-warning/10 border-l-2 border-l-warning' : ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={record.isSelected}
                            onCheckedChange={() => toggleRecordSelection(record.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(record.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm" title={record.description}>
                            {record.description || '—'}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${record.type === 'ENTRADA' ? 'text-success' : 'text-destructive'}`}>
                          {record.type === 'ENTRADA' ? '+' : '-'}R$ {record.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={record.suggestedPartner?.id || 'none'}
                            onValueChange={(value) => updateRecordPartner(record.id, value === 'none' ? '' : value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione...">
                                {record.suggestedPartner && (
                                  <div className="flex items-center gap-1">
                                    {record.suggestedPartner.name}
                                    {record.suggestedPartner.is_recurring && (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                    {record.matchConfidence >= 75 && (
                                      <Check className="w-3 h-3 text-success" />
                                    )}
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {getFilteredPartners(record.type).map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-1">
                                    {p.name}
                                    {p.is_recurring && <RefreshCw className="w-3 h-3" />}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Select
                              value={record.suggestedCategory?.id || ''}
                              onValueChange={(value) => updateRecordCategory(record.id, value)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${needsCategory ? 'border-warning' : ''}`}>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getFilteredCategories(record.type).map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {needsCategory && (
                              <Badge variant="outline" className="text-[10px] border-warning text-warning shrink-0">
                                Definir
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.valueDivergence && (
                            <div className="group relative">
                              <AlertTriangle className="w-4 h-4 text-warning cursor-help" />
                              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-48 p-2 bg-popover border rounded-lg shadow-lg text-xs">
                                <p className="font-medium">Valor diferente!</p>
                                <p>Esperado: R$ {record.valueDivergence.expected.toFixed(2)}</p>
                                <p>Informado: R$ {record.valueDivergence.actual.toFixed(2)}</p>
                                <p className={record.valueDivergence.difference > 0 ? 'text-success' : 'text-destructive'}>
                                  Diferença: {record.valueDivergence.difference > 0 ? '+' : ''}R$ {record.valueDivergence.difference.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          )}
                          {!record.suggestedPartner && !record.valueDivergence && (
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Import Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {summary.withoutCategory > 0 ? (
                  <span className="text-warning flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {summary.withoutCategory} transações selecionadas precisam de categoria
                  </span>
                ) : summary.total > 0 ? (
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Todas as {summary.total} transações têm categoria definida
                  </span>
                ) : null}
              </div>
              <Button
                size="lg"
                onClick={handleImport}
                disabled={isImporting || summary.withCategory === 0}
              >
                {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Importar {summary.withCategory} de {summary.total} transações
              </Button>
            </div>
          </>
        )}

        {/* Empty State */}
        {!parseResult && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum arquivo carregado</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Selecione a unidade e conta, depois carregue um arquivo OFX ou CSV do seu extrato bancário para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
