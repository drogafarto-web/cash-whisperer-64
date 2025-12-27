import { useState, useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import {
  useSeedPayroll,
  useSaveSeedPayroll,
  useSeedTaxes,
  useSaveSeedTaxes,
  useSeedRevenue,
  useSaveSeedRevenue,
  useSeedProgress,
  useSeedInitialData,
  useSaveSeedInitialData,
  useSaveAccountBalances,
  useSaveCompanyData,
  useTaxConfig,
  SeedPayroll,
  SeedTaxes,
  SeedRevenue,
  SeedInitialData,
  CompanyData,
  StaffData,
  SEED_PERIODS,
  TOTAL_SEED_MONTHS,
} from '@/hooks/useSeedData';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Users,
  Receipt,
  DollarSign,
  Save,
  Calculator,
  Building2,
  Wallet,
  Info,
  CheckCircle,
  Circle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

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

export default function FiscalBase() {
  const navigate = useNavigate();
  const { isAdmin, isContador, isContabilidade, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('folha');

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-fiscal'],
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
  const { data: initialData } = useSeedInitialData();
  const { data: taxConfig } = useTaxConfig();
  const progress = useSeedProgress();

  const savePayroll = useSaveSeedPayroll();
  const saveTaxes = useSaveSeedTaxes();
  const saveRevenue = useSaveSeedRevenue();
  const saveInitialData = useSaveSeedInitialData();
  const saveAccountBalances = useSaveAccountBalances();
  const saveCompanyData = useSaveCompanyData();

  // Local state for editing
  const [payrollRows, setPayrollRows] = useState<SeedPayroll[]>([]);
  const [taxesRows, setTaxesRows] = useState<SeedTaxes[]>([]);
  const [revenueRows, setRevenueRows] = useState<SeedRevenue[]>([]);
  
  // State for company/staff info
  const [accountBalances, setAccountBalances] = useState<{ account_id: string; name: string; initial_balance: number }[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyData>({
    cnpj: '',
    regime_tributario: 'SIMPLES',
    iss_aliquota: 5,
    data_inicio_atividades: '',
  });
  const [staffInfo, setStaffInfo] = useState<StaffData>({
    funcionarios_clt: 0,
    socios_ativos: 0,
    observacoes: '',
  });
  const [generalNotes, setGeneralNotes] = useState('');

  // Initialize rows from fetched data
  useEffect(() => {
    if (payrollData !== undefined) {
      const initialRows: SeedPayroll[] = SEED_PERIODS.map(period => {
        const existing = payrollData.find(p => p.ano === period.ano && p.mes === period.mes);
        return existing || {
          ano: period.ano,
          mes: period.mes,
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
    if (taxesData !== undefined) {
      const initialRows: SeedTaxes[] = SEED_PERIODS.map(period => {
        const existing = taxesData.find(t => t.ano === period.ano && t.mes === period.mes);
        return existing || {
          ano: period.ano,
          mes: period.mes,
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
    if (revenueData !== undefined) {
      const initialRows: SeedRevenue[] = SEED_PERIODS.map(period => {
        const existing = revenueData.find(r => r.ano === period.ano && r.mes === period.mes);
        return existing || {
          ano: period.ano,
          mes: period.mes,
          receita_servicos: 0,
          receita_outras: 0,
        };
      });
      setRevenueRows(initialRows);
    }
  }, [revenueData]);

  useEffect(() => {
    if (accounts.length > 0) {
      setAccountBalances(accounts.map(acc => ({
        account_id: acc.id,
        name: acc.name,
        initial_balance: acc.initial_balance || 0,
      })));
    }
  }, [accounts]);

  useEffect(() => {
    if (taxConfig) {
      setCompanyInfo({
        cnpj: taxConfig.cnpj || '',
        regime_tributario: (taxConfig.regime_atual as 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL') || 'SIMPLES',
        iss_aliquota: (taxConfig.iss_aliquota || 0.05) * 100,
        data_inicio_atividades: '',
      });
    }
  }, [taxConfig]);

  useEffect(() => {
    if (initialData) {
      const staffItem = initialData.find(i => i.categoria === 'quadro_pessoal' && i.chave === 'quadro_geral');
      if (staffItem && staffItem.valor) {
        setStaffInfo({
          funcionarios_clt: Number(staffItem.valor.funcionarios_clt) || 0,
          socios_ativos: Number(staffItem.valor.socios_ativos) || 0,
          observacoes: String(staffItem.valor.observacoes || ''),
        });
      }
      
      const notesItem = initialData.find(i => i.categoria === 'observacoes' && i.chave === 'geral');
      if (notesItem && notesItem.valor) {
        setGeneralNotes(String(notesItem.valor.texto || ''));
      }
    }
  }, [initialData]);

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

  const fatorRHistorico = useMemo(() => {
    const folhaTotal = payrollTotals.salarios + payrollTotals.prolabore + payrollTotals.inss_patronal +
      payrollTotals.fgts + payrollTotals.decimo_terceiro + payrollTotals.ferias;
    const receitaTotal = revenueTotals.receita_servicos + revenueTotals.receita_outras;
    if (receitaTotal === 0) return 0;
    return (folhaTotal / receitaTotal) * 100;
  }, [payrollTotals, revenueTotals]);

  // Handlers
  const handlePayrollChange = (ano: number, mes: number, field: string, value: string) => {
    setPayrollRows(rows =>
      rows.map(row =>
        row.ano === ano && row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleTaxesChange = (ano: number, mes: number, field: string, value: string) => {
    setTaxesRows(rows =>
      rows.map(row =>
        row.ano === ano && row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleRevenueChange = (ano: number, mes: number, field: string, value: string) => {
    setRevenueRows(rows =>
      rows.map(row =>
        row.ano === ano && row.mes === mes ? { ...row, [field]: parseFloat(value) || 0 } : row
      )
    );
  };

  const handleSaveParameters = async () => {
    try {
      await saveCompanyData.mutateAsync(companyInfo);

      const itemsToSave: SeedInitialData[] = [
        {
          categoria: 'quadro_pessoal',
          chave: 'quadro_geral',
          valor: {
            funcionarios_clt: staffInfo.funcionarios_clt,
            socios_ativos: staffInfo.socios_ativos,
            observacoes: staffInfo.observacoes || '',
          },
          data_referencia: '2024-10-31',
        },
        {
          categoria: 'observacoes',
          chave: 'geral',
          valor: { texto: generalNotes },
        },
      ];
      await saveInitialData.mutateAsync(itemsToSave);

      if (accountBalances.length > 0) {
        await saveAccountBalances.mutateAsync(
          accountBalances.map(b => ({ account_id: b.account_id, initial_balance: b.initial_balance }))
        );
      }

      toast.success('Parâmetros salvos com sucesso!');
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('Erro ao salvar parâmetros');
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const getPeriodLabel = (ano: number, mes: number) => {
    return SEED_PERIODS.find(p => p.ano === ano && p.mes === mes)?.label || `${mes}/${ano}`;
  };

  const getStatusIcon = (count: number) => {
    if (count === TOTAL_SEED_MONTHS) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (count > 0) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  // Access control - allow admin, contador, and legacy contabilidade
  const hasAccess = isAdmin || isContador || isContabilidade;

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/accounting-panel')}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Painel
            </Button>
          </div>

          <ScreenGuide
            purpose="Nesta área você gerencia os dados fiscais e trabalhistas que alimentam os cálculos tributários."
            steps={[
              '1. Preencha os dados de folha de pagamento mês a mês',
              '2. Informe os impostos pagos em cada período',
              '3. Registre as receitas de serviços e outras',
              '4. Configure os parâmetros da empresa (CNPJ, regime, alíquotas)',
            ]}
          />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Calculator className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Base Fiscal & Folha</h1>
                <p className="text-muted-foreground">
                  Dados oficiais para cálculo de Fator R e cenários tributários
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Fator R Histórico</p>
                <p className={`text-2xl font-bold ${fatorRHistorico >= 28 ? 'text-green-600' : 'text-red-500'}`}>
                  {fatorRHistorico.toFixed(1)}%
                </p>
              </div>
              <Badge variant={fatorRHistorico >= 28 ? 'default' : 'destructive'}>
                {fatorRHistorico >= 28 ? 'Anexo III' : 'Anexo V'}
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso Geral</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress.totalProgress)}% concluído
                </span>
              </div>
              <Progress value={progress.totalProgress} className="h-2" />
              <div className="flex gap-6 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  {getStatusIcon(progress.payrollMonths)}
                  <span>Folha: {progress.payrollMonths}/{TOTAL_SEED_MONTHS}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(progress.taxesMonths)}
                  <span>Impostos: {progress.taxesMonths}/{TOTAL_SEED_MONTHS}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(progress.revenueMonths)}
                  <span>Receita: {progress.revenueMonths}/{TOTAL_SEED_MONTHS}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="folha" className="gap-2">
                <Users className="h-4 w-4" />
                Folha
              </TabsTrigger>
              <TabsTrigger value="impostos" className="gap-2">
                <Receipt className="h-4 w-4" />
                Impostos
              </TabsTrigger>
              <TabsTrigger value="receitas" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Receitas
              </TabsTrigger>
              <TabsTrigger value="parametros" className="gap-2">
                <Building2 className="h-4 w-4" />
                Parâmetros
              </TabsTrigger>
            </TabsList>

            {/* Folha Tab */}
            <TabsContent value="folha" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Folha de Pagamento</CardTitle>
                      <CardDescription>
                        Dados mensais de salários, encargos e benefícios que compõem o Fator R
                      </CardDescription>
                    </div>
                    <Button onClick={() => savePayroll.mutateAsync(payrollRows)} disabled={savePayroll.isPending}>
                      {savePayroll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Período</TableHead>
                          {PAYROLL_COLUMNS.map(col => (
                            <TableHead key={col.key} className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{col.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{col.tooltip}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollRows.map(row => (
                          <TableRow key={`${row.ano}-${row.mes}`}>
                            <TableCell className="font-medium">{getPeriodLabel(row.ano, row.mes)}</TableCell>
                            {PAYROLL_COLUMNS.map(col => (
                              <TableCell key={col.key} className="text-right">
                                <Input
                                  type="number"
                                  value={row[col.key as keyof SeedPayroll] || ''}
                                  onChange={e => handlePayrollChange(row.ano, row.mes, col.key, e.target.value)}
                                  className="w-28 text-right"
                                  placeholder="0"
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          {PAYROLL_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              {formatCurrency(payrollTotals[col.key] || 0)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Impostos Tab */}
            <TabsContent value="impostos" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Impostos Pagos</CardTitle>
                      <CardDescription>
                        Tributos recolhidos mensalmente
                      </CardDescription>
                    </div>
                    <Button onClick={() => saveTaxes.mutateAsync(taxesRows)} disabled={saveTaxes.isPending}>
                      {saveTaxes.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Período</TableHead>
                          {TAXES_COLUMNS.map(col => (
                            <TableHead key={col.key} className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{col.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{col.tooltip}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxesRows.map(row => (
                          <TableRow key={`${row.ano}-${row.mes}`}>
                            <TableCell className="font-medium">{getPeriodLabel(row.ano, row.mes)}</TableCell>
                            {TAXES_COLUMNS.map(col => (
                              <TableCell key={col.key} className="text-right">
                                <Input
                                  type="number"
                                  value={row[col.key as keyof SeedTaxes] || ''}
                                  onChange={e => handleTaxesChange(row.ano, row.mes, col.key, e.target.value)}
                                  className="w-28 text-right"
                                  placeholder="0"
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          {TAXES_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              {formatCurrency(taxesTotals[col.key] || 0)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Receitas Tab */}
            <TabsContent value="receitas" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Receitas</CardTitle>
                      <CardDescription>
                        Faturamento mensal para cálculo do Fator R (RBT12)
                      </CardDescription>
                    </div>
                    <Button onClick={() => saveRevenue.mutateAsync(revenueRows)} disabled={saveRevenue.isPending}>
                      {saveRevenue.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Período</TableHead>
                          {REVENUE_COLUMNS.map(col => (
                            <TableHead key={col.key} className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{col.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{col.tooltip}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueRows.map(row => (
                          <TableRow key={`${row.ano}-${row.mes}`}>
                            <TableCell className="font-medium">{getPeriodLabel(row.ano, row.mes)}</TableCell>
                            {REVENUE_COLUMNS.map(col => (
                              <TableCell key={col.key} className="text-right">
                                <Input
                                  type="number"
                                  value={row[col.key as keyof SeedRevenue] || ''}
                                  onChange={e => handleRevenueChange(row.ano, row.mes, col.key, e.target.value)}
                                  className="w-36 text-right"
                                  placeholder="0"
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          {REVENUE_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              {formatCurrency(revenueTotals[col.key] || 0)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Parâmetros Tab */}
            <TabsContent value="parametros" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Dados da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      value={companyInfo.cnpj}
                      onChange={e => setCompanyInfo(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select
                      value={companyInfo.regime_tributario}
                      onValueChange={value => setCompanyInfo(prev => ({ ...prev, regime_tributario: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                        <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                        <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Alíquota ISS (%)</Label>
                    <Input
                      type="number"
                      value={companyInfo.iss_aliquota}
                      onChange={e => setCompanyInfo(prev => ({ ...prev, iss_aliquota: parseFloat(e.target.value) || 0 }))}
                      placeholder="5"
                      min={0}
                      max={5}
                      step={0.01}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Início Atividades</Label>
                    <Input
                      type="date"
                      value={companyInfo.data_inicio_atividades}
                      onChange={e => setCompanyInfo(prev => ({ ...prev, data_inicio_atividades: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Quadro de Pessoal
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Funcionários CLT</Label>
                    <Input
                      type="number"
                      value={staffInfo.funcionarios_clt}
                      onChange={e => setStaffInfo(prev => ({ ...prev, funcionarios_clt: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sócios Ativos</Label>
                    <Input
                      type="number"
                      value={staffInfo.socios_ativos}
                      onChange={e => setStaffInfo(prev => ({ ...prev, socios_ativos: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input
                      value={staffInfo.observacoes}
                      onChange={e => setStaffInfo(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Notas sobre o quadro"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Saldos Iniciais das Contas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {accountBalances.map(acc => (
                      <div key={acc.account_id} className="flex items-center gap-3">
                        <Label className="min-w-32">{acc.name}</Label>
                        <Input
                          type="number"
                          value={acc.initial_balance}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setAccountBalances(prev =>
                              prev.map(a => a.account_id === acc.account_id ? { ...a, initial_balance: val } : a)
                            );
                          }}
                          className="w-36 text-right"
                          placeholder="0,00"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Observações Gerais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={generalNotes}
                    onChange={e => setGeneralNotes(e.target.value)}
                    placeholder="Anotações importantes sobre a base fiscal, contexto histórico, decisões tomadas..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveParameters} size="lg">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Parâmetros
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
