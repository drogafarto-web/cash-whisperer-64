import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  ShieldAlert,
  Scale,
} from 'lucide-react';
import { Unit, PersonnelCostSummary } from '@/types/database';
import {
  simulateRegularization,
  findOptimalRegularization,
  generateRegularizationDiagnostics,
  RegularizationInput,
  RegularizationResult,
} from '@/services/regularizationSimulator';
import {
  DEFAULT_TAX_PARAMETERS,
  TaxParameters,
} from '@/services/taxSimulator';

export default function PersonnelRealVsOfficial() {
  const { isAdmin, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [regularizationPercent, setRegularizationPercent] = useState<number>(0);

  // Buscar unidades
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Buscar parâmetros tributários
  const { data: taxParameters } = useQuery({
    queryKey: ['tax-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_parameters')
        .select('*')
        .eq('ano', 2025)
        .single();
      
      if (error || !data) return DEFAULT_TAX_PARAMETERS;
      
      return {
        ...data,
        simples_anexo3_faixas: data.simples_anexo3_faixas as unknown as TaxParameters['simples_anexo3_faixas'],
        simples_anexo5_faixas: data.simples_anexo5_faixas as unknown as TaxParameters['simples_anexo5_faixas'],
      } as TaxParameters;
    },
  });

  // Buscar transações dos últimos 12 meses com categorias e parceiros
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['personnel-transactions', selectedUnitId, selectedMonth],
    queryFn: async () => {
      const endDate = endOfMonth(new Date(selectedMonth + '-01'));
      const startDate = startOfMonth(subMonths(endDate, 11));

      let query = supabase
        .from('transactions')
        .select(`
          *,
          category:categories(id, name, type, tax_group, entra_fator_r, is_informal),
          partner:partners(id, name, type)
        `)
        .eq('category.tax_group', 'PESSOAL')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('status', 'APROVADO')
        .is('deleted_at', null);

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedMonth,
  });

  // Buscar receita total para cálculos
  const { data: revenueData } = useQuery({
    queryKey: ['revenue-data', selectedUnitId, selectedMonth],
    queryFn: async () => {
      const endDate = endOfMonth(new Date(selectedMonth + '-01'));
      const startDate = startOfMonth(subMonths(endDate, 11));

      let query = supabase
        .from('transactions')
        .select('amount, date')
        .eq('type', 'ENTRADA')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('status', 'APROVADO')
        .is('deleted_at', null);

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedMonth,
  });

  // Processar dados de pessoal
  const personnelData = useMemo(() => {
    if (!transactionsData) return null;

    const byPartner = new Map<string, { 
      name: string; 
      partnerId: string | null;
      salarioOficial: number; 
      pagamentosInformais: number;
    }>();
    
    let totalOficial = 0;
    let totalInformal = 0;
    let totalReceita = 0;
    let receitaMensal = 0;

    // Calcular receita
    if (revenueData) {
      const currentMonthStart = startOfMonth(new Date(selectedMonth + '-01'));
      revenueData.forEach((tx: any) => {
        const amount = Math.abs(Number(tx.amount));
        totalReceita += amount;
        
        const txDate = new Date(tx.date);
        if (txDate >= currentMonthStart) {
          receitaMensal += amount;
        }
      });
    }

    // Processar transações de pessoal
    transactionsData.forEach((tx: any) => {
      if (tx.category?.tax_group !== 'PESSOAL') return;
      
      const amount = Math.abs(Number(tx.amount));
      const isInformal = tx.category?.is_informal ?? false;
      const partnerName = tx.partner?.name || 'Sem vínculo específico';
      const partnerId = tx.partner_id;
      
      if (!byPartner.has(partnerName)) {
        byPartner.set(partnerName, { 
          name: partnerName, 
          partnerId,
          salarioOficial: 0, 
          pagamentosInformais: 0 
        });
      }
      
      const data = byPartner.get(partnerName)!;
      
      if (isInformal) {
        data.pagamentosInformais += amount;
        totalInformal += amount;
      } else if (tx.category?.entra_fator_r) {
        data.salarioOficial += amount;
        totalOficial += amount;
      }
    });

    // Converter para array e calcular percentuais
    const personnelList: PersonnelCostSummary[] = Array.from(byPartner.values())
      .map(p => ({
        funcionario: p.name,
        partnerId: p.partnerId,
        salarioOficial: p.salarioOficial,
        pagamentosInformais: p.pagamentosInformais,
        custoTotal: p.salarioOficial + p.pagamentosInformais,
        percentualInformal: p.salarioOficial + p.pagamentosInformais > 0
          ? (p.pagamentosInformais / (p.salarioOficial + p.pagamentosInformais)) * 100
          : 0,
      }))
      .filter(p => p.custoTotal > 0)
      .sort((a, b) => b.pagamentosInformais - a.pagamentosInformais);

    return {
      personnelList,
      totalOficial,
      totalInformal,
      totalCusto: totalOficial + totalInformal,
      percentualInformalTotal: totalOficial + totalInformal > 0
        ? (totalInformal / (totalOficial + totalInformal)) * 100
        : 0,
      totalReceita,
      receitaMensal,
    };
  }, [transactionsData, revenueData, selectedMonth]);

  // Simular regularização
  const regularizationResult = useMemo<RegularizationResult | null>(() => {
    if (!personnelData || !taxParameters || personnelData.totalReceita === 0) return null;

    const input: RegularizationInput = {
      folhaOficial12: personnelData.totalOficial,
      pagamentosInformais12: personnelData.totalInformal,
      rbt12: personnelData.totalReceita,
      receitaMensal: personnelData.receitaMensal,
      taxParameters,
    };

    return simulateRegularization(input, regularizationPercent);
  }, [personnelData, taxParameters, regularizationPercent]);

  // Encontrar regularização ótima
  const optimalResult = useMemo(() => {
    if (!personnelData || !taxParameters || personnelData.totalReceita === 0) return null;

    const input: RegularizationInput = {
      folhaOficial12: personnelData.totalOficial,
      pagamentosInformais12: personnelData.totalInformal,
      rbt12: personnelData.totalReceita,
      receitaMensal: personnelData.receitaMensal,
      taxParameters,
    };

    return findOptimalRegularization(input);
  }, [personnelData, taxParameters]);

  // Diagnósticos
  const diagnostics = useMemo(() => {
    if (!regularizationResult) return [];
    return generateRegularizationDiagnostics(regularizationResult);
  }, [regularizationResult]);

  // Gerar meses para seleção
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  // Set initial unit
  useEffect(() => {
    if (!isAdmin && unit?.id) {
      setSelectedUnitId(unit.id);
    }
  }, [isAdmin, unit]);

  const formatPercentLocal = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Dados para gráfico de comparação
  const chartData = useMemo(() => {
    if (!regularizationResult) return [];
    
    return [
      {
        name: 'Cenário Atual',
        folhaOficial: personnelData?.totalOficial || 0,
        informal: personnelData?.totalInformal || 0,
        fatorR: regularizationResult.fatorRAtual * 100,
      },
      {
        name: `Regularização ${regularizationPercent}%`,
        folhaOficial: regularizationResult.folhaSimulada,
        informal: (personnelData?.totalInformal || 0) * (1 - regularizationPercent / 100),
        fatorR: regularizationResult.fatorRSimulado * 100,
      },
    ];
  }, [regularizationResult, personnelData, regularizationPercent]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Pessoal: Real x Oficial
            </h1>
            <p className="text-muted-foreground">
              Diagnóstico e planejamento de regularização de custos de pessoal
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && (
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Aviso de Risco */}
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Relatório de Diagnóstico Interno</AlertTitle>
          <AlertDescription>
            Este relatório é exclusivamente para <strong>diagnóstico e planejamento de regularização</strong>. 
            Pagamentos não registrados em folha representam <strong>risco trabalhista e fiscal</strong>. 
            Consulte seu contador e advogado trabalhista para validar qualquer decisão.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : personnelData && personnelData.totalCusto > 0 ? (
          <>
            {/* Cards de Resumo */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Folha Oficial (12m)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(personnelData.totalOficial)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entra no Fator R
                  </p>
                </CardContent>
              </Card>

              <Card className="border-amber-500/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    Pagamentos Informais (12m)
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Valores pagos "por fora" da folha. Não entram no Fator R e representam risco trabalhista/fiscal.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(personnelData.totalInformal)}
                  </div>
                  <p className="text-sm text-amber-600">
                    ⚠️ Risco trabalhista/fiscal
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Custo Total Real</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(personnelData.totalCusto)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPercent(personnelData.percentualInformalTotal)} informal
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fator R Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${regularizationResult?.fatorRAtual && regularizationResult.fatorRAtual >= 0.28 ? 'text-green-600' : 'text-red-600'}`}>
                    {regularizationResult ? formatPercent(regularizationResult.fatorRAtual * 100) : '--'}
                  </div>
                  <Badge variant={regularizationResult?.anexoAtual === 'III' ? 'default' : 'destructive'}>
                    Anexo {regularizationResult?.anexoAtual || '--'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Simulador de Regularização */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Simulador de Regularização
                </CardTitle>
                <CardDescription>
                  Simule o impacto de regularizar diferentes percentuais dos pagamentos informais.
                  Esta é apenas uma estimativa para planejamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Percentual de regularização</Label>
                    <span className="text-2xl font-bold">{regularizationPercent}%</span>
                  </div>
                  <Slider
                    value={[regularizationPercent]}
                    onValueChange={(v) => setRegularizationPercent(v[0])}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% (manter atual)</span>
                    <span>50%</span>
                    <span>100% (regularizar tudo)</span>
                  </div>
                  {optimalResult && optimalResult.percentual > 0 && (
                    <Alert>
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Sugestão:</strong> Regularizar {optimalResult.percentual}% pode gerar o melhor resultado líquido 
                        ({formatCurrency(optimalResult.resultado.resultadoLiquido)}/ano).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Comparação */}
                {regularizationResult && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Cenário Atual</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Folha Oficial:</span>
                          <span>{formatCurrency(personnelData.totalOficial)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fator R:</span>
                          <span className={regularizationResult.fatorRAtual >= 0.28 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(regularizationResult.fatorRAtual * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Anexo:</span>
                          <Badge variant={regularizationResult.anexoAtual === 'III' ? 'default' : 'destructive'}>
                            {regularizationResult.anexoAtual}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alíquota Efetiva:</span>
                          <span>{formatPercent(regularizationResult.aliquotaAtual * 100)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          Cenário Simulado ({regularizationPercent}% regularizado)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Folha Simulada:</span>
                          <span>{formatCurrency(regularizationResult.folhaSimulada)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fator R:</span>
                          <span className={regularizationResult.fatorRSimulado >= 0.28 ? 'text-green-600' : 'text-amber-600'}>
                            {formatPercent(regularizationResult.fatorRSimulado * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Anexo:</span>
                          <Badge variant={regularizationResult.anexoSimulado === 'III' ? 'default' : 'secondary'}>
                            {regularizationResult.anexoSimulado}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alíquota Efetiva:</span>
                          <span>{formatPercent(regularizationResult.aliquotaSimulada * 100)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Impacto Financeiro */}
                {regularizationResult && regularizationPercent > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Impacto Financeiro Anual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                          <TrendingDown className="h-6 w-6 mx-auto text-red-600 mb-2" />
                          <div className="text-lg font-bold text-red-600">
                            {formatCurrency(regularizationResult.custoAdicionalEncargos)}
                          </div>
                          <p className="text-sm text-muted-foreground">Custo adicional encargos</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                          <TrendingUp className="h-6 w-6 mx-auto text-green-600 mb-2" />
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(regularizationResult.economiaImposto)}
                          </div>
                          <p className="text-sm text-muted-foreground">Economia tributária</p>
                        </div>
                        <div className={`text-center p-4 rounded-lg ${regularizationResult.resultadoLiquido >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-amber-50 dark:bg-amber-950'}`}>
                          <Scale className="h-6 w-6 mx-auto mb-2" />
                          <div className={`text-lg font-bold ${regularizationResult.resultadoLiquido >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                            {formatCurrency(regularizationResult.resultadoLiquido)}
                          </div>
                          <p className="text-sm text-muted-foreground">Resultado líquido</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Diagnósticos */}
                {diagnostics.length > 0 && (
                  <div className="space-y-2">
                    {diagnostics.map((diag, idx) => (
                      <Alert key={idx} variant="default">
                        <AlertDescription>{diag}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela por Funcionário */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Funcionário/Vínculo</CardTitle>
                <CardDescription>
                  Custos oficiais vs. informais por colaborador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário/Vínculo</TableHead>
                      <TableHead className="text-right">Salário Oficial</TableHead>
                      <TableHead className="text-right">Pagamentos Informais</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">% Informal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnelData.personnelList.map((person) => (
                      <TableRow key={person.funcionario}>
                        <TableCell className="font-medium">{person.funcionario}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(person.salarioOficial)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {person.pagamentosInformais > 0 ? (
                            <>
                              {formatCurrency(person.pagamentosInformais)}
                              <AlertTriangle className="inline h-4 w-4 ml-1" />
                            </>
                          ) : (
                            formatCurrency(0)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(person.custoTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {person.percentualInformal > 0 ? (
                            <Badge variant="destructive">
                              {formatPercent(person.percentualInformal)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">0%</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totais */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(personnelData.totalOficial)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatCurrency(personnelData.totalInformal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(personnelData.totalCusto)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={personnelData.percentualInformalTotal > 0 ? 'destructive' : 'outline'}>
                          {formatPercent(personnelData.percentualInformalTotal)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Gráfico de Comparação */}
            {chartData.length > 0 && regularizationPercent > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparação Visual</CardTitle>
                  <CardDescription>
                    Folha oficial vs. pagamentos informais nos dois cenários
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis
                        tickFormatter={(v) => formatCurrency(v).replace('R$', '')}
                        className="text-xs"
                      />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <Bar
                        dataKey="folhaOficial"
                        name="Folha Oficial"
                        fill="hsl(var(--chart-1))"
                        stackId="a"
                      />
                      <Bar
                        dataKey="informal"
                        name="Pagamentos Informais"
                        fill="hsl(var(--chart-4))"
                        stackId="a"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Disclaimer Final */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Esta ferramenta é apenas para <strong>diagnóstico e planejamento</strong>.</li>
                  <li>Os cálculos são estimativas baseadas em premissas simplificadas.</li>
                  <li>A taxa de encargos estimada (~50%) pode variar conforme a situação específica.</li>
                  <li>Toda decisão de regularização deve ser validada com <strong>contador e advogado trabalhista</strong>.</li>
                  <li>A regularização elimina riscos trabalhistas e fiscais, independente do resultado financeiro imediato.</li>
                </ul>
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sem dados</AlertTitle>
            <AlertDescription>
              Não há transações de pessoal aprovadas no período selecionado.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
