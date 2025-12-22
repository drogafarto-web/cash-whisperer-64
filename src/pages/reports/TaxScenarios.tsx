import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Info,
  CheckCircle,
} from 'lucide-react';
import { Unit } from '@/types/database';
import {
  runTaxSimulation,
  TaxSimulationOutput,
  MonthlyFinancialData,
  TaxParameters,
  TaxConfig,
  createEmptyMonthlyData,
  DEFAULT_TAX_PARAMETERS,
  DEFAULT_TAX_CONFIG,
  mapTaxGroupToFinancialCategory,
  calculateFolha12,
  calculateRBT12,
  calculateProlaboreAdjustment,
  calculateAnexoSavings,
  ProlaboreAdjustment,
  AnexoSavings,
} from '@/services/taxSimulator';
import { FatorRAlert } from '@/components/alerts/FatorRAlert';

export default function TaxScenarios() {
  const { isAdmin, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

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

  // Buscar configuração tributária da unidade
  const { data: taxConfig } = useQuery({
    queryKey: ['tax-config', selectedUnitId],
    queryFn: async () => {
      if (selectedUnitId === 'all') return DEFAULT_TAX_CONFIG;
      
      const { data, error } = await supabase
        .from('tax_config')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .single();
      
      if (error || !data) return DEFAULT_TAX_CONFIG;
      
      return {
        regime_atual: data.regime_atual as TaxConfig['regime_atual'],
        iss_aliquota: Number(data.iss_aliquota),
        cnpj: data.cnpj || undefined,
      } as TaxConfig;
    },
    enabled: selectedUnitId !== '',
  });

  // Buscar transações dos últimos 12 meses com categorias
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['tax-transactions', selectedUnitId, selectedMonth],
    queryFn: async () => {
      const endDate = endOfMonth(new Date(selectedMonth + '-01'));
      const startDate = startOfMonth(subMonths(endDate, 11));

      let query = supabase
        .from('transactions')
        .select(`
          *,
          category:categories(id, name, type, tax_group)
        `)
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

  // Processar dados para o simulador
  const simulationResult = useMemo<TaxSimulationOutput | null>(() => {
    if (!transactionsData || !taxParameters || !taxConfig) return null;

    // Agrupar transações por mês
    const monthlyDataMap = new Map<string, MonthlyFinancialData>();
    
    // Inicializar os 12 meses
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(selectedMonth + '-01'), 11 - i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyDataMap.set(monthKey, createEmptyMonthlyData(monthKey));
    }

    // Processar transações
    transactionsData.forEach((tx: any) => {
      const monthKey = format(new Date(tx.date), 'yyyy-MM');
      const data = monthlyDataMap.get(monthKey);
      if (!data) return;

      const taxGroup = tx.category?.tax_group;
      const amount = Math.abs(Number(tx.amount));

      if (tx.type === 'ENTRADA') {
        if (taxGroup === 'RECEITA_SERVICOS') {
          data.receita_servicos += amount;
        } else {
          data.receita_outras += amount;
        }
      } else {
        // SAIDA
        switch (taxGroup) {
          case 'PESSOAL':
            // Tentar identificar tipo de despesa de pessoal pelo nome da categoria
            const catName = tx.category?.name?.toLowerCase() || '';
            if (catName.includes('pró-labore') || catName.includes('pro-labore')) {
              data.folha_prolabore += amount;
            } else if (catName.includes('inss') || catName.includes('fgts') || catName.includes('encargo')) {
              data.folha_encargos += amount;
            } else {
              data.folha_salarios += amount;
            }
            break;
          case 'INSUMOS':
            data.insumos += amount;
            break;
          case 'SERVICOS_TERCEIROS':
            data.servicos_terceiros += amount;
            break;
          case 'ADMINISTRATIVAS':
            data.despesas_administrativas += amount;
            break;
          case 'FINANCEIRAS':
            data.despesas_financeiras += amount;
            break;
          case 'TRIBUTARIAS':
            data.impostos_pagos += amount;
            break;
          default:
            data.despesas_administrativas += amount;
        }
      }
    });

    const monthlyDataArray = Array.from(monthlyDataMap.values());
    const currentMonthData = monthlyDataArray.find(m => m.mes === selectedMonth) || createEmptyMonthlyData(selectedMonth);

    return runTaxSimulation({
      monthlyData: currentMonthData,
      last12MonthsData: monthlyDataArray,
      taxConfig,
      taxParameters,
    });
  }, [transactionsData, taxParameters, taxConfig, selectedMonth]);

  // Dados para o gráfico de barras
  const barChartData = useMemo(() => {
    if (!simulationResult) return [];
    
    return simulationResult.cenarios.map(c => ({
      name: c.regimeLabel,
      valor: c.total,
      percentual: c.percentualReceita,
    }));
  }, [simulationResult]);

  // Dados para o gráfico de evolução mensal (12 meses)
  const lineChartData = useMemo(() => {
    if (!transactionsData || !taxParameters || !taxConfig) return [];

    // Agrupar transações por mês (mesmo código da simulação)
    const monthlyDataMap = new Map<string, MonthlyFinancialData>();
    
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(selectedMonth + '-01'), 11 - i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyDataMap.set(monthKey, createEmptyMonthlyData(monthKey));
    }

    transactionsData.forEach((tx: any) => {
      const monthKey = format(new Date(tx.date), 'yyyy-MM');
      const data = monthlyDataMap.get(monthKey);
      if (!data) return;

      const taxGroup = tx.category?.tax_group;
      const amount = Math.abs(Number(tx.amount));

      if (tx.type === 'ENTRADA') {
        if (taxGroup === 'RECEITA_SERVICOS') {
          data.receita_servicos += amount;
        } else {
          data.receita_outras += amount;
        }
      } else {
        switch (taxGroup) {
          case 'PESSOAL':
            const catName = tx.category?.name?.toLowerCase() || '';
            if (catName.includes('pró-labore') || catName.includes('pro-labore')) {
              data.folha_prolabore += amount;
            } else if (catName.includes('inss') || catName.includes('fgts') || catName.includes('encargo')) {
              data.folha_encargos += amount;
            } else {
              data.folha_salarios += amount;
            }
            break;
          case 'INSUMOS':
            data.insumos += amount;
            break;
          case 'SERVICOS_TERCEIROS':
            data.servicos_terceiros += amount;
            break;
          case 'ADMINISTRATIVAS':
            data.despesas_administrativas += amount;
            break;
          case 'FINANCEIRAS':
            data.despesas_financeiras += amount;
            break;
          case 'TRIBUTARIAS':
            data.impostos_pagos += amount;
            break;
          default:
            data.despesas_administrativas += amount;
        }
      }
    });

    const monthlyDataArray = Array.from(monthlyDataMap.values());

    // Para cada mês, calcular os 4 cenários
    return monthlyDataArray.map((monthData, index) => {
      // Usar dados acumulados até aquele mês para RBT12 correto
      const dataUpToMonth = monthlyDataArray.slice(0, index + 1);
      // Preencher com meses vazios se não tiver 12 meses
      while (dataUpToMonth.length < 12) {
        dataUpToMonth.unshift(createEmptyMonthlyData(''));
      }

      const simulation = runTaxSimulation({
        monthlyData: monthData,
        last12MonthsData: dataUpToMonth.slice(-12),
        taxConfig,
        taxParameters,
      });

      const receita = monthData.receita_servicos + monthData.receita_outras;

      return {
        mes: format(new Date(monthData.mes + '-01'), 'MMM/yy', { locale: ptBR }),
        simples: receita > 0 ? simulation.cenarios.find(c => c.regime === 'SIMPLES')?.percentualReceita || 0 : 0,
        presumido: receita > 0 ? simulation.cenarios.find(c => c.regime === 'PRESUMIDO')?.percentualReceita || 0 : 0,
        real: receita > 0 ? simulation.cenarios.find(c => c.regime === 'REAL')?.percentualReceita || 0 : 0,
        cbsIbs: receita > 0 ? simulation.cenarios.find(c => c.regime === 'CBS_IBS')?.percentualReceita || 0 : 0,
        receita,
      };
    }).filter(d => d.receita > 0);
  }, [transactionsData, taxParameters, taxConfig, selectedMonth]);

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

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getScenarioColor = (regime: string) => {
    switch (regime) {
      case 'SIMPLES': return 'hsl(var(--chart-1))';
      case 'PRESUMIDO': return 'hsl(var(--chart-2))';
      case 'REAL': return 'hsl(var(--chart-3))';
      case 'CBS_IBS': return 'hsl(var(--chart-4))';
      default: return 'hsl(var(--chart-5))';
    }
  };

  const getDiagnosticIcon = (text: string) => {
    if (text.startsWith('⚠️')) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (text.startsWith('✅')) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (text.startsWith('💡')) return <Lightbulb className="h-5 w-5 text-blue-500" />;
    if (text.startsWith('📊')) return <Info className="h-5 w-5 text-purple-500" />;
    if (text.startsWith('🔮')) return <Info className="h-5 w-5 text-indigo-500" />;
    return <Info className="h-5 w-5 text-muted-foreground" />;
  };

  const cleanDiagnosticText = (text: string) => {
    return text.replace(/^[⚠️✅💡📊🔮]\s*/, '');
  };

  // Helper component for Fator R Alert in TaxScenarios
  const FatorRAlertCard = ({ 
    fatorR, 
    rbt12, 
    receitaMensal, 
    taxParameters 
  }: { 
    fatorR: number; 
    rbt12: number; 
    receitaMensal: number; 
    taxParameters: TaxParameters;
  }) => {
    const folha12 = rbt12 * fatorR;
    const adjustment = calculateProlaboreAdjustment(folha12, rbt12);
    const savings = calculateAnexoSavings(receitaMensal, rbt12, taxParameters);

    return (
      <FatorRAlert
        fatorRAtual={adjustment.fatorRAtual}
        ajusteMensal={adjustment.ajusteMensal}
        ajusteAnual={adjustment.ajusteNecessario}
        status={adjustment.status}
        economiaMensal={savings.economiaMensal}
        economiaAnual={savings.economiaAnual}
        aliquotaAnexo3={savings.aliquotaAnexo3}
        aliquotaAnexo5={savings.aliquotaAnexo5}
        showLink={false}
      />
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Cenários Tributários
            </h1>
            <p className="text-muted-foreground">
              Simulação comparativa de regimes fiscais para laboratórios
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
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
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

        {/* Fator R Badge and Alert */}
        {simulationResult && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Badge
                variant={simulationResult.fatorR >= 0.28 ? 'default' : 'destructive'}
                className="text-sm px-3 py-1"
              >
                Fator R: {(simulationResult.fatorR * 100).toFixed(1)}%
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                Anexo {simulationResult.anexoSimples}
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                Receita: {formatCurrency(simulationResult.receitaTotal)}
              </Badge>
            </div>

            {/* Fator R Alert Card when below threshold */}
            {simulationResult.fatorR < 0.28 && taxParameters && (
              <FatorRAlertCard
                fatorR={simulationResult.fatorR}
                rbt12={simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0}
                receitaMensal={simulationResult.receitaTotal}
                taxParameters={taxParameters}
              />
            )}
          </>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
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
        ) : simulationResult ? (
          <>
            {/* Cards de Cenários */}
            <div className="grid gap-4 md:grid-cols-4">
              {simulationResult.cenarios.map((cenario) => {
                const isBest = cenario.regime === simulationResult.melhorCenario.regime;
                const isCurrentRegime = cenario.regime === taxConfig?.regime_atual;
                const diff = isCurrentRegime ? 0 : cenario.total - (simulationResult.cenarios.find(c => c.regime === taxConfig?.regime_atual)?.total || 0);

                return (
                  <Card
                    key={cenario.regime}
                    className={`relative ${isBest ? 'ring-2 ring-primary' : ''}`}
                  >
                    {isBest && (
                      <Badge className="absolute -top-2 -right-2 text-xs">
                        Melhor opção
                      </Badge>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        {cenario.regimeLabel}
                        {isCurrentRegime && (
                          <Badge variant="outline" className="text-xs">Atual</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(cenario.total)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatPercent(cenario.percentualReceita)} da receita
                      </p>
                      {!isCurrentRegime && diff !== 0 && (
                        <div className={`flex items-center gap-1 text-sm mt-2 ${diff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {diff < 0 ? '-' : '+'}
                          {formatCurrency(Math.abs(diff))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico de Evolução Mensal */}
            {lineChartData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Evolução da Carga Tributária (12 meses)</CardTitle>
                  <CardDescription>
                    Percentual da receita destinado a impostos em cada regime ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={lineChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        className="text-xs"
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                        labelFormatter={(label) => `Mês: ${label}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="simples"
                        name="Simples Nacional"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="presumido"
                        name="Lucro Presumido"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="real"
                        name="Lucro Real"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cbsIbs"
                        name="CBS/IBS (Reforma)"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de Barras */}
            <Card>
              <CardHeader>
                <CardTitle>Comparativo de Impostos</CardTitle>
                <CardDescription>
                  Valor total de impostos por regime tributário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v).replace('R$', '')}
                      className="text-xs"
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Imposto']}
                      labelFormatter={(label) => `Regime: ${label}`}
                    />
                    <Bar
                      dataKey="valor"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabela Detalhada */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Regime</CardTitle>
                <CardDescription>
                  Breakdown dos impostos e base de cálculo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Regime</TableHead>
                      <TableHead className="text-right">Base de Cálculo</TableHead>
                      <TableHead className="text-right">Federais</TableHead>
                      <TableHead className="text-right">ISS/IBS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">% Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulationResult.cenarios.map((cenario) => (
                      <TableRow key={cenario.regime}>
                        <TableCell className="font-medium">
                          {cenario.regimeLabel}
                          {cenario.regime === taxConfig?.regime_atual && (
                            <Badge variant="outline" className="ml-2 text-xs">Atual</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.baseCalculo)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.impostosFederais)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.issIbs)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(cenario.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(cenario.percentualReceita)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Diagnósticos */}
            <Card>
              <CardHeader>
                <CardTitle>Diagnósticos e Recomendações</CardTitle>
                <CardDescription>
                  Análises automáticas baseadas nos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {simulationResult.diagnosticos.map((diag, idx) => (
                  <Alert key={idx} variant="default">
                    {getDiagnosticIcon(diag)}
                    <AlertDescription className="ml-2">
                      {cleanDiagnosticText(diag)}
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>

            {/* Comentários Técnicos */}
            <Card>
              <CardHeader>
                <CardTitle>Comentários Técnicos por Regime</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulationResult.cenarios.map((cenario) => (
                  <div key={cenario.regime} className="border-l-4 border-primary pl-4">
                    <h4 className="font-semibold">{cenario.regimeLabel}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {cenario.comentarioTecnico}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Aviso */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Esta ferramenta gera <strong>simulações estimativas</strong> para apoio à decisão. 
                A migração de regime tributário deve ser validada por contador habilitado. 
                Os valores de CBS/IBS são estimativas baseadas na proposta atual da reforma tributária.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Sem dados</AlertTitle>
            <AlertDescription>
              Não há transações aprovadas no período selecionado para realizar a simulação.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
