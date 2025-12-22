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
  useSeedInitialData,
  useSaveSeedInitialData,
  useSaveAccountBalances,
  useSaveCompanyData,
  useTaxConfig,
  usePopulateTestData,
  SeedPayroll,
  SeedTaxes,
  SeedRevenue,
  SeedInitialData,
  CompanyData,
  StaffData,
  SEED_PERIODS,
  TOTAL_SEED_MONTHS,
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  FileText, 
  Users, 
  Receipt, 
  DollarSign,
  ChevronDown,
  Upload,
  CheckCircle,
  Circle,
  AlertTriangle,
  Info,
  Save,
  Calculator,
  Link2,
  Calendar,
  Heart,
  Settings2,
  Building2,
  Wallet,
  FlaskConical,
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

export default function DataSeed2025() {
  const { isAdmin, isContabilidade, isLoading: authLoading } = useAuth();
  const [openSections, setOpenSections] = useState({
    extratos: false,
    folha: true,
    impostos: false,
    receita: false,
    outras: false,
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
  const { data: initialData } = useSeedInitialData();
  const { data: taxConfig } = useTaxConfig();
  const progress = useSeedProgress();

  const savePayroll = useSaveSeedPayroll();
  const saveTaxes = useSaveSeedTaxes();
  const saveRevenue = useSaveSeedRevenue();
  const uploadStatement = useUploadSeedStatement();
  const saveInitialData = useSaveSeedInitialData();
  const saveAccountBalances = useSaveAccountBalances();
  const saveCompanyData = useSaveCompanyData();
  const populateTestData = usePopulateTestData();

  // Local state for editing
  const [payrollRows, setPayrollRows] = useState<SeedPayroll[]>([]);
  const [taxesRows, setTaxesRows] = useState<SeedTaxes[]>([]);
  const [revenueRows, setRevenueRows] = useState<SeedRevenue[]>([]);
  
  // State for "Outras Informações"
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

  // Initialize rows from fetched data (14 meses: Nov/2024 - Dez/2025)
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

  // Initialize account balances from accounts data
  useEffect(() => {
    if (accounts.length > 0) {
      setAccountBalances(accounts.map(acc => ({
        account_id: acc.id,
        name: acc.name,
        initial_balance: acc.initial_balance || 0,
      })));
    }
  }, [accounts]);

  // Initialize company data from tax_config
  useEffect(() => {
    if (taxConfig) {
      setCompanyInfo({
        cnpj: taxConfig.cnpj || '',
        regime_tributario: (taxConfig.regime_atual as 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL') || 'SIMPLES',
        iss_aliquota: (taxConfig.iss_aliquota || 0.05) * 100, // Converte decimal para percentual
        data_inicio_atividades: '',
      });
    }
  }, [taxConfig]);

  // Initialize staff info and notes from initialData
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

  const cargaTributariaHistorica = useMemo(() => {
    const impostosTotal = taxesTotals.das + taxesTotals.iss_proprio + taxesTotals.iss_retido + 
                          taxesTotals.irrf_retido + taxesTotals.outros;
    const receitaTotal = revenueTotals.receita_servicos + revenueTotals.receita_outras;
    if (receitaTotal === 0) return 0;
    return (impostosTotal / receitaTotal) * 100;
  }, [taxesTotals, revenueTotals]);

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

  const handleFileUpload = async (ano: number, mes: number, file: File) => {
    if (!selectedAccountId) return;
    await uploadStatement.mutateAsync({ file, accountId: selectedAccountId, ano, mes });
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/settings/data-2025`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado! Envie para a contabilidade');
  };

  const handleSaveOutrasInformacoes = async () => {
    try {
      // Salvar saldos das contas
      if (accountBalances.length > 0) {
        await saveAccountBalances.mutateAsync(
          accountBalances.map(b => ({ account_id: b.account_id, initial_balance: b.initial_balance }))
        );
      }

      // Salvar dados da empresa
      await saveCompanyData.mutateAsync(companyInfo);

      // Salvar quadro de pessoal e observações na tabela seed_initial_data
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

      toast.success('Outras informações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving outras informacoes:', error);
    }
  };

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (count: number) => {
    if (count === TOTAL_SEED_MONTHS) return <CheckCircle className="h-5 w-5 text-success" />;
    if (count > 0) return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusLabel = (count: number) => {
    if (count === TOTAL_SEED_MONTHS) return 'Concluído';
    if (count > 0) return 'Em andamento';
    return 'Não iniciado';
  };

  const getPeriodLabel = (ano: number, mes: number) => {
    return SEED_PERIODS.find(p => p.ano === ano && p.mes === mes)?.label || `${mes}/${ano}`;
  };

  const isYear2024 = (ano: number) => ano === 2024;

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <div>
              <h1 className="text-2xl font-bold">Dados para Prestação de Contas</h1>
                <p className="text-muted-foreground">
                  Período: Nov/2024 a Dez/2025 ({TOTAL_SEED_MONTHS} meses)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      onClick={() => populateTestData.mutate()}
                      disabled={populateTestData.isPending}
                      className="gap-2"
                    >
                      <FlaskConical className="h-4 w-4" />
                      {populateTestData.isPending ? 'Inserindo...' : 'Dados de Teste'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Insere dados realistas de um laboratório de análises clínicas com Fator R ~23% para testar os cenários tributários</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                <Link2 className="h-4 w-4" />
                Copiar link para contabilidade
              </Button>
            </div>
          </div>

          {/* Context Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10 mt-1">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Prestação de Contas</h3>
                  <p className="text-sm text-muted-foreground">
                    Este módulo registra os dados históricos do período de prestação de contas, 
                    iniciado em <strong>novembro de 2024</strong>. Os dados aqui inseridos são usados para:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Cálculo do Fator R histórico</li>
                    <li>Análises comparativas de regimes tributários</li>
                    <li>Relatórios de auditoria e compliance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Overview */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Progresso Geral</span>
                    <span className="text-sm font-bold">{progress.totalProgress}%</span>
                  </div>
                  <Progress value={progress.totalProgress} className="h-3" />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
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
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Registre os valores consolidados de <strong>Nov/2024 a Dez/2025</strong> (extratos, folha, impostos, receita).
              Esses dados são usados apenas para análises históricas — não interferem na operação futura.
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
                      <CardTitle className="text-lg">1. Extratos Bancários</CardTitle>
                      <CardDescription>Upload de extratos CSV/PDF por mês e conta (Nov/2024 - Dez/2025)</CardDescription>
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
                  <div className="space-y-4">
                    {/* 2024 Section */}
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Badge variant="outline">2024</Badge>
                        Início da prestação de contas
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {SEED_PERIODS.filter(p => p.ano === 2024).map(period => {
                          const monthStatements = statementsData?.filter(s => s.ano === period.ano && s.mes === period.mes) || [];
                          const hasFiles = monthStatements.length > 0;

                          return (
                            <div 
                              key={`${period.ano}-${period.mes}`} 
                              className={`p-4 rounded-lg border-2 ${hasFiles ? 'border-success bg-success/5' : 'border-dashed border-primary/30 bg-primary/5'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{period.label}</span>
                                {hasFiles && <CheckCircle className="h-4 w-4 text-success" />}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`file-${period.ano}-${period.mes}`} className="cursor-pointer">
                                  <div className="flex items-center justify-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                    <Upload className="h-4 w-4" />
                                    <span className="text-sm">Enviar</span>
                                  </div>
                                  <Input
                                    id={`file-${period.ano}-${period.mes}`}
                                    type="file"
                                    accept=".csv,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(period.ano, period.mes, file);
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
                    </div>

                    {/* 2025 Section */}
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Badge variant="outline">2025</Badge>
                        Ano corrente
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {SEED_PERIODS.filter(p => p.ano === 2025).map(period => {
                          const monthStatements = statementsData?.filter(s => s.ano === period.ano && s.mes === period.mes) || [];
                          const hasFiles = monthStatements.length > 0;

                          return (
                            <div 
                              key={`${period.ano}-${period.mes}`} 
                              className={`p-4 rounded-lg border-2 ${hasFiles ? 'border-success bg-success/5' : 'border-dashed'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{period.label}</span>
                                {hasFiles && <CheckCircle className="h-4 w-4 text-success" />}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`file-${period.ano}-${period.mes}`} className="cursor-pointer">
                                  <div className="flex items-center justify-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                    <Upload className="h-4 w-4" />
                                    <span className="text-sm">Enviar</span>
                                  </div>
                                  <Input
                                    id={`file-${period.ano}-${period.mes}`}
                                    type="file"
                                    accept=".csv,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(period.ano, period.mes, file);
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
                    </div>
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
                      <CardTitle className="text-lg">2. Folha de Pagamento</CardTitle>
                      <CardDescription>Salários, pró-labore, encargos e benefícios (Nov/2024 - Dez/2025)</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.payrollComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.payrollMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.payrollMonths}/{TOTAL_SEED_MONTHS}</span>
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
                        <TableHead className="w-24">Período</TableHead>
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
                      {payrollRows.map((row, index) => (
                        <TableRow 
                          key={`${row.ano}-${row.mes}`}
                          className={isYear2024(row.ano) ? 'bg-primary/5' : ''}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getPeriodLabel(row.ano, row.mes)}
                              {index === 0 && <Badge variant="outline" className="text-[10px]">Início</Badge>}
                            </div>
                          </TableCell>
                          {PAYROLL_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-28 text-right"
                                value={row[col.key as keyof SeedPayroll] || ''}
                                onChange={(e) => handlePayrollChange(row.ano, row.mes, col.key, e.target.value)}
                                placeholder="0,00"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL ({TOTAL_SEED_MONTHS} meses)</TableCell>
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
                      <span className="font-medium">Fator R Histórico (Nov/2024 - Dez/2025)</span>
                      <p className="text-xs text-muted-foreground">
                        Folha Total / Receita Total × 100
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${fatorRHistorico >= 28 ? 'text-success' : 'text-destructive'}`}>
                      {fatorRHistorico.toFixed(2)}%
                    </span>
                    {fatorRHistorico >= 28 ? (
                      <Badge variant="default" className="bg-success">Anexo III</Badge>
                    ) : fatorRHistorico > 0 ? (
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
                    {savePayroll.isPending ? 'Salvando...' : 'Salvar Folha'}
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
                      <CardTitle className="text-lg">3. Impostos Pagos</CardTitle>
                      <CardDescription>DAS, ISS, IRRF e outros tributos (Nov/2024 - Dez/2025)</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.taxesComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.taxesMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.taxesMonths}/{TOTAL_SEED_MONTHS}</span>
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
                        <TableHead className="w-24">Período</TableHead>
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
                      {taxesRows.map((row, index) => (
                        <TableRow 
                          key={`${row.ano}-${row.mes}`}
                          className={isYear2024(row.ano) ? 'bg-primary/5' : ''}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getPeriodLabel(row.ano, row.mes)}
                              {index === 0 && <Badge variant="outline" className="text-[10px]">Início</Badge>}
                            </div>
                          </TableCell>
                          {TAXES_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-28 text-right"
                                value={row[col.key as keyof SeedTaxes] || ''}
                                onChange={(e) => handleTaxesChange(row.ano, row.mes, col.key, e.target.value)}
                                placeholder="0,00"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL ({TOTAL_SEED_MONTHS} meses)</TableCell>
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
                      <span className="font-medium">Carga Tributária Efetiva (Nov/2024 - Dez/2025)</span>
                      <p className="text-xs text-muted-foreground">
                        Impostos Total / Receita Total × 100
                      </p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${cargaTributariaHistorica <= 15 ? 'text-success' : cargaTributariaHistorica <= 20 ? 'text-warning' : 'text-destructive'}`}>
                    {cargaTributariaHistorica.toFixed(2)}%
                  </span>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveTaxes.mutate(taxesRows)}
                    disabled={saveTaxes.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveTaxes.isPending ? 'Salvando...' : 'Salvar Impostos'}
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
                      <CardTitle className="text-lg">4. Receita</CardTitle>
                      <CardDescription>Faturamento de serviços e outras receitas (Nov/2024 - Dez/2025)</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={progress.revenueComplete ? 'default' : 'secondary'}>
                      {getStatusLabel(progress.revenueMonths)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{progress.revenueMonths}/{TOTAL_SEED_MONTHS}</span>
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
                        <TableHead className="w-24">Período</TableHead>
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
                      {revenueRows.map((row, index) => {
                        const monthTotal = (Number(row.receita_servicos) || 0) + (Number(row.receita_outras) || 0);
                        return (
                          <TableRow 
                            key={`${row.ano}-${row.mes}`}
                            className={isYear2024(row.ano) ? 'bg-primary/5' : ''}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getPeriodLabel(row.ano, row.mes)}
                                {index === 0 && <Badge variant="outline" className="text-[10px]">Início</Badge>}
                              </div>
                            </TableCell>
                            {REVENUE_COLUMNS.map(col => (
                              <TableCell key={col.key} className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-36 text-right"
                                  value={row[col.key as keyof SeedRevenue] || ''}
                                  onChange={(e) => handleRevenueChange(row.ano, row.mes, col.key, e.target.value)}
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
                        <TableCell>TOTAL ({TOTAL_SEED_MONTHS} meses)</TableCell>
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
                    {saveRevenue.isPending ? 'Salvando...' : 'Salvar Receita'}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Step 5: Outras Informações */}
        <Collapsible open={openSections.outras} onOpenChange={() => toggleSection('outras')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-500/10">
                      <Settings2 className="h-6 w-6 text-slate-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">5. Outras Informações</CardTitle>
                      <CardDescription>Saldos iniciais, dados da empresa e observações gerais</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Opcional</Badge>
                    <ChevronDown className={`h-5 w-5 transition-transform ${openSections.outras ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-8">
                {/* Sub-seção: Saldos Iniciais */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Saldos Iniciais das Contas (31/10/2024)</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Informe o saldo de cada conta na data anterior ao início da prestação de contas.
                  </p>
                  <div className="grid gap-4">
                    {accountBalances.map((account) => (
                      <div key={account.account_id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                        <span className="flex-1 font-medium">{account.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-40 text-right"
                            value={account.initial_balance || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setAccountBalances(prev => 
                                prev.map(b => b.account_id === account.account_id 
                                  ? { ...b, initial_balance: value } 
                                  : b
                                )
                              );
                            }}
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                    ))}
                    {accountBalances.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhuma conta cadastrada. Acesse Configurações → Contas para criar.
                      </p>
                    )}
                  </div>
                </div>

                {/* Sub-seção: Dados da Empresa */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Dados da Empresa</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={companyInfo.cnpj}
                        onChange={(e) => setCompanyInfo(prev => ({ 
                          ...prev, 
                          cnpj: formatCNPJ(e.target.value) 
                        }))}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regime">Regime Tributário</Label>
                      <Select 
                        value={companyInfo.regime_tributario}
                        onValueChange={(value: 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL') => 
                          setCompanyInfo(prev => ({ ...prev, regime_tributario: value }))
                        }
                      >
                        <SelectTrigger id="regime">
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
                      <Label htmlFor="iss">Alíquota ISS (%)</Label>
                      <Input
                        id="iss"
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={companyInfo.iss_aliquota || ''}
                        onChange={(e) => setCompanyInfo(prev => ({ 
                          ...prev, 
                          iss_aliquota: parseFloat(e.target.value) || 0 
                        }))}
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_inicio">Data Início Atividades</Label>
                      <Input
                        id="data_inicio"
                        type="date"
                        value={companyInfo.data_inicio_atividades || ''}
                        onChange={(e) => setCompanyInfo(prev => ({ 
                          ...prev, 
                          data_inicio_atividades: e.target.value 
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-seção: Quadro de Pessoal */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Quadro de Pessoal (Nov/2024)</h3>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="funcionarios">Nº Funcionários CLT</Label>
                      <Input
                        id="funcionarios"
                        type="number"
                        min="0"
                        value={staffInfo.funcionarios_clt || ''}
                        onChange={(e) => setStaffInfo(prev => ({ 
                          ...prev, 
                          funcionarios_clt: parseInt(e.target.value) || 0 
                        }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="socios">Nº Sócios Ativos</Label>
                      <Input
                        id="socios"
                        type="number"
                        min="0"
                        value={staffInfo.socios_ativos || ''}
                        onChange={(e) => setStaffInfo(prev => ({ 
                          ...prev, 
                          socios_ativos: parseInt(e.target.value) || 0 
                        }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="obs_pessoal">Observações sobre Folha</Label>
                      <Textarea
                        id="obs_pessoal"
                        value={staffInfo.observacoes || ''}
                        onChange={(e) => setStaffInfo(prev => ({ 
                          ...prev, 
                          observacoes: e.target.value 
                        }))}
                        placeholder="Ex: Demissão prevista para março, férias coletivas em dezembro..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-seção: Observações Gerais */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Observações Gerais</h3>
                  </div>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Notas importantes para a contabilidade...&#10;Ex: Existe parcelamento de FGTS em aberto, conta Santander foi encerrada em Jan/2025, pendência com fornecedor X..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveOutrasInformacoes}
                    disabled={saveAccountBalances.isPending || saveCompanyData.isPending || saveInitialData.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {(saveAccountBalances.isPending || saveCompanyData.isPending || saveInitialData.isPending) 
                      ? 'Salvando...' 
                      : 'Salvar Outras Informações'}
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
