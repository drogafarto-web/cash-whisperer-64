import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { 
  useSeedPayroll, 
  useSaveSeedPayroll,
  useSeedTaxes,
  useSaveSeedTaxes,
  useSeedRevenue,
  useSaveSeedRevenue,
  useSeedBankStatements,
  useUploadSeedStatement,
  useSeedProgress,
  SeedPayroll,
  SeedTaxes,
  SeedRevenue,
} from '@/hooks/useSeedData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  Users, 
  Receipt, 
  DollarSign,
  ChevronDown,
  Upload,
  Download,
  CheckCircle,
  Circle,
  AlertTriangle,
  Info,
  Save,
  Calculator,
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const PAYROLL_COLUMNS = [
  { key: 'salarios', label: 'Salários Brutos', tooltip: 'Total de salários brutos pagos aos funcionários CLT' },
  { key: 'prolabore', label: 'Pró-labore', tooltip: 'Retirada dos sócios com encargos (INSS)' },
  { key: 'inss_patronal', label: 'INSS Patronal', tooltip: 'Contribuição patronal ao INSS (CPP)' },
  { key: 'fgts', label: 'FGTS', tooltip: 'Fundo de Garantia por Tempo de Serviço (8%)' },
  { key: 'decimo_terceiro', label: '13º', tooltip: 'Décimo terceiro salário (proporcional ou integral)' },
  { key: 'ferias', label: 'Férias', tooltip: 'Pagamento de férias + 1/3 constitucional' },
];

const TAXES_COLUMNS = [
  { key: 'das', label: 'DAS', tooltip: 'Documento de Arrecadação do Simples Nacional' },
  { key: 'iss_proprio', label: 'ISS Próprio', tooltip: 'ISS recolhido pela empresa (não retido)' },
  { key: 'iss_retido', label: 'ISS Retido', tooltip: 'ISS retido na fonte por tomadores' },
  { key: 'irrf_retido', label: 'IRRF Retido', tooltip: 'Imposto de Renda Retido na Fonte' },
  { key: 'outros', label: 'Outros', tooltip: 'Outros tributos (PIS, COFINS, CSLL, etc.)' },
];

const REVENUE_COLUMNS = [
  { key: 'receita_servicos', label: 'Receita de Serviços', tooltip: 'Faturamento de exames e serviços laboratoriais' },
  { key: 'receita_outras', label: 'Outras Receitas', tooltip: 'Outras receitas (rendimentos, vendas, etc.)' },
];

export default function DataSeed2025() {
  const { isAdmin, isContabilidade, isLoading: authLoading } = useAuth();
  const [openSections, setOpenSections] = useState({
    extratos: false,
    folha: true,
    impostos: false,
    receita: false,
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Fetch accounts for extrato section
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-seed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Seed data hooks
  const { data: payrollData, isLoading: payrollLoading } = useSeedPayroll();
  const { data: taxesData, isLoading: taxesLoading } = useSeedTaxes();
  const { data: revenueData, isLoading: revenueLoading } = useSeedRevenue();
  const { data: statementsData } = useSeedBankStatements(selectedAccountId);
  const progress = useSeedProgress();

  const savePayroll = useSaveSeedPayroll();
  const saveTaxes = useSaveSeedTaxes();
  const saveRevenue = useSaveSeedRevenue();
  const uploadStatement = useUploadSeedStatement();

  // Local state for editing
  const [payrollRows, setPayrollRows] = useState<SeedPayroll[]>([]);
  const [taxesRows, setTaxesRows] = useState<SeedTaxes[]>([]);
  const [revenueRows, setRevenueRows] = useState<SeedRevenue[]>([]);

  // Initialize rows from fetched data
  useEffect(() => {
    if (payrollData) {
      const initialRows: SeedPayroll[] = MONTHS.map(m => {
        const existing = payrollData.find(p => p.mes === m.value);
        return existing || {
          ano: 2025,
          mes: m.value,
          salarios: 0,
          prolabore: 0,
          inss_patronal: 0,
          fgts: 0,
          decimo_terceiro: 0,
          ferias: 0,
        };
      });
      setPayrollRows(initialRows);
    }
  }, [payrollData]);

  useEffect(() => {
    if (taxesData) {
      const initialRows: SeedTaxes[] = MONTHS.map(m => {
        const existing = taxesData.find(t => t.mes === m.value);
        return existing || {
          ano: 2025,
          mes: m.value,
          das: 0,
          iss_proprio: 0,
          iss_retido: 0,
          irrf_retido: 0,
          outros: 0,
        };
      });
      setTaxesRows(initialRows);
    }
  }, [taxesData]);

  useEffect(() => {
    if (revenueData) {
      const initialRows: SeedRevenue[] = MONTHS.map(m => {
        const existing = revenueData.find(r => r.mes === m.value);
        return existing || {
          ano: 2025,
          mes: m.value,
          receita_servicos: 0,
          receita_outras: 0,
        };
      });
      setRevenueRows(initialRows);
    }
  }, [revenueData]);

  // Calculations
  const payrollTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    PAYROLL_COLUMNS.forEach(col => {
      totals[col.key] = payrollRows.reduce((sum, row) => sum + (Number(row[col.key as keyof SeedPayroll]) || 0), 0);
    });
    return totals;
  }, [payrollRows]);

  const taxesTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    TAXES_COLUMNS.forEach(col => {
      totals[col.key] = taxesRows.reduce((sum, row) => sum + (Number(row[col.key as keyof SeedTaxes]) || 0), 0);
    });
    return totals;
  }, [taxesRows]);

  const revenueTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    REVENUE_COLUMNS.forEach(col => {
      totals[col.key] = revenueRows.reduce((sum, row) => sum + (Number(row[col.key as keyof SeedRevenue]) || 0), 0);
    });
    return totals;
  }, [revenueRows]);

  const fatorR2025 = useMemo(() => {
    const folhaTotal = payrollTotals.salarios + payrollTotals.prolabore + payrollTotals.inss_patronal + 
                       payrollTotals.fgts + payrollTotals.decimo_terceiro + payrollTotals.ferias;
    const receitaTotal = revenueTotals.receita_servicos + revenueTotals.receita_outras;
    if (receitaTotal === 0) return 0;
    return (folhaTotal / receitaTotal) * 100;
  }, [payrollTotals, revenueTotals]);

  const cargaTributaria2025 = useMemo(() => {
    const impostosTotal = taxesTotals.das + taxesTotals.iss_proprio + taxesTotals.iss_retido + 
                          taxesTotals.irrf_retido + taxesTotals.outros;
    const receitaTotal = revenueTotals.receita_servicos + revenueTotals.receita_outras;
    if (receitaTotal === 0) return 0;
    return (impostosTotal / receitaTotal) * 100;
  }, [taxesTotals, revenueTotals]);

  // Handlers
  const handlePayrollChange = (mes: number, field: string, value: string) => {
    setPayrollRows(rows => 
      rows.map(row => 
        row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleTaxesChange = (mes: number, field: string, value: string) => {
    setTaxesRows(rows => 
      rows.map(row => 
        row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleRevenueChange = (mes: number, field: string, value: string) => {
    setRevenueRows(rows => 
      rows.map(row => 
        row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleFileUpload = async (mes: number, file: File) => {
    if (!selectedAccountId) return;
    await uploadStatement.mutateAsync({ file, accountId: selectedAccountId, mes });
  };

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (count: number) => {
    if (count === 12) return <CheckCircle className="h-5 w-5 text-success" />;
    if (count > 0) return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusLabel = (count: number) => {
    if (count === 12) return 'Concluído';
    if (count > 0) return 'Em andamento';
    return 'Não iniciado';
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin && !isContabilidade) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Povoação de Dados 2025</h1>
              <p className="text-muted-foreground">
                Assistente para registrar valores consolidados do ano de 2025
              </p>
            </div>
          </div>

          {/* Progress Overview */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Progresso Geral</span>
                    <span className="text-sm font-bold">{progress.totalProgress}%</span>
                  </div>
                  <Progress value={progress.totalProgress} className="h-3" />
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(progress.payrollMonths)}
                    <span>Folha: {progress.payrollMonths}/12</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(progress.taxesMonths)}
                    <span>Impostos: {progress.taxesMonths}/12</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(progress.revenueMonths)}
                    <span>Receita: {progress.revenueMonths}/12</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este assistente serve para registrar os valores consolidados de 2025 (extratos, folha, impostos, receita).
              <strong> Esses dados são usados apenas para análises históricas de 2025</strong> — não interferem na operação de 2026 em diante.
            </AlertDescription>
          </Alert>
        </div>

        {/* Step 1: Extratos */}
        <Collapsible open={openSections.extratos} onOpenChange={() => toggleSection('extratos')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <FileText className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">1. Extratos Bancários 2025</CardTitle>
                      <CardDescription>Upload de extratos CSV/PDF por mês e conta</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Opcional</Badge>
                    <ChevronDown className={`h-5 w-5 transition-transform ${openSections.extratos ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label>Selecione a Conta:</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Escolha uma conta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAccountId && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MONTHS.map(month => {
                      const monthStatements = statementsData?.filter(s => s.mes === month.value) || [];
                      const hasFiles = monthStatements.length > 0;

                      return (
                        <div 
                          key={month.value} 
                          className={`p-4 rounded-lg border-2 ${hasFiles ? 'border-success bg-success/5' : 'border-dashed'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{month.label}</span>
                            {hasFiles && <CheckCircle className="h-4 w-4 text-success" />}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`file-${month.value}`} className="cursor-pointer">
                              <div className="flex items-center justify-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                <Upload className="h-4 w-4" />
                                <span className="text-sm">Enviar</span>
                              </div>
                              <Input
                                id={`file-${month.value}`}
                                type="file"
                                accept=".csv,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(month.value, file);
                                }}
                              />
                            </Label>
                            {monthStatements.map(stmt => (
                              <div key={stmt.id} className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
                                <span className="truncate max-w-[100px]">{stmt.file_name}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {stmt.file_type.toUpperCase()}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Step 2: Folha de Pagamento */}
        <Collapsible open={openSections.folha} onOpenChange={() => toggleSection('folha')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Users className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">2. Folha de Pagamento 2025</CardTitle>
                      <CardDescription>Salários, pró-labore, encargos e benefícios</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.payrollComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.payrollMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.payrollMonths}/12</span>
                    <ChevronDown className={`h-5 w-5 transition-transform ${openSections.folha ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Mês</TableHead>
                        {PAYROLL_COLUMNS.map(col => (
                          <TableHead key={col.key} className="text-right min-w-[120px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  {col.label}
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[200px]">{col.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRows.map(row => (
                        <TableRow key={row.mes}>
                          <TableCell className="font-medium">
                            {MONTHS.find(m => m.value === row.mes)?.label}
                          </TableCell>
                          {PAYROLL_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-28 text-right"
                                value={row[col.key as keyof SeedPayroll] || ''}
                                onChange={(e) => handlePayrollChange(row.mes, col.key, e.target.value)}
                                placeholder="0,00"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        {PAYROLL_COLUMNS.map(col => (
                          <TableCell key={col.key} className="text-right">
                            {formatCurrency(payrollTotals[col.key] || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Fator R Card */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Calculator className="h-5 w-5 text-primary" />
                    <div>
                      <span className="font-medium">Fator R 2025 (estimado)</span>
                      <p className="text-xs text-muted-foreground">
                        Folha Total / Receita Total × 100
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${fatorR2025 >= 28 ? 'text-success' : 'text-destructive'}`}>
                      {fatorR2025.toFixed(2)}%
                    </span>
                    {fatorR2025 >= 28 ? (
                      <Badge variant="default" className="bg-success">Anexo III</Badge>
                    ) : fatorR2025 > 0 ? (
                      <Badge variant="destructive">Anexo V</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => savePayroll.mutate(payrollRows)}
                    disabled={savePayroll.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savePayroll.isPending ? 'Salvando...' : 'Salvar Folha 2025'}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Step 3: Impostos */}
        <Collapsible open={openSections.impostos} onOpenChange={() => toggleSection('impostos')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Receipt className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">3. Impostos Pagos 2025</CardTitle>
                      <CardDescription>DAS, ISS, IRRF e outros tributos</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.taxesComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.taxesMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.taxesMonths}/12</span>
                    <ChevronDown className={`h-5 w-5 transition-transform ${openSections.impostos ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Mês</TableHead>
                        {TAXES_COLUMNS.map(col => (
                          <TableHead key={col.key} className="text-right min-w-[120px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  {col.label}
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[200px]">{col.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxesRows.map(row => (
                        <TableRow key={row.mes}>
                          <TableCell className="font-medium">
                            {MONTHS.find(m => m.value === row.mes)?.label}
                          </TableCell>
                          {TAXES_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-28 text-right"
                                value={row[col.key as keyof SeedTaxes] || ''}
                                onChange={(e) => handleTaxesChange(row.mes, col.key, e.target.value)}
                                placeholder="0,00"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        {TAXES_COLUMNS.map(col => (
                          <TableCell key={col.key} className="text-right">
                            {formatCurrency(taxesTotals[col.key] || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Carga Tributária Card */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-primary" />
                    <div>
                      <span className="font-medium">Carga Tributária Efetiva 2025</span>
                      <p className="text-xs text-muted-foreground">
                        Impostos Total / Receita Total × 100
                      </p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${cargaTributaria2025 <= 15 ? 'text-success' : cargaTributaria2025 <= 20 ? 'text-warning' : 'text-destructive'}`}>
                    {cargaTributaria2025.toFixed(2)}%
                  </span>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveTaxes.mutate(taxesRows)}
                    disabled={saveTaxes.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveTaxes.isPending ? 'Salvando...' : 'Salvar Impostos 2025'}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Step 4: Receita */}
        <Collapsible open={openSections.receita} onOpenChange={() => toggleSection('receita')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <DollarSign className="h-6 w-6 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">4. Receita 2025</CardTitle>
                      <CardDescription>Faturamento de serviços e outras receitas</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.revenueComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.revenueMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.revenueMonths}/12</span>
                    <ChevronDown className={`h-5 w-5 transition-transform ${openSections.receita ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Mês</TableHead>
                        {REVENUE_COLUMNS.map(col => (
                          <TableHead key={col.key} className="text-right min-w-[150px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  {col.label}
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[200px]">{col.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total Mês</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueRows.map(row => {
                        const monthTotal = (Number(row.receita_servicos) || 0) + (Number(row.receita_outras) || 0);
                        return (
                          <TableRow key={row.mes}>
                            <TableCell className="font-medium">
                              {MONTHS.find(m => m.value === row.mes)?.label}
                            </TableCell>
                            {REVENUE_COLUMNS.map(col => (
                              <TableCell key={col.key} className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-36 text-right"
                                  value={row[col.key as keyof SeedRevenue] || ''}
                                  onChange={(e) => handleRevenueChange(row.mes, col.key, e.target.value)}
                                  placeholder="0,00"
                                />
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-medium">
                              {formatCurrency(monthTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        {REVENUE_COLUMNS.map(col => (
                          <TableCell key={col.key} className="text-right">
                            {formatCurrency(revenueTotals[col.key] || 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          {formatCurrency((revenueTotals.receita_servicos || 0) + (revenueTotals.receita_outras || 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveRevenue.mutate(revenueRows)}
                    disabled={saveRevenue.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveRevenue.isPending ? 'Salvando...' : 'Salvar Receita 2025'}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppLayout>
  );
}
