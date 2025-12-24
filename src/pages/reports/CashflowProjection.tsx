import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { runCashflowProjection, CashflowProjectionResult, CashflowWeek } from '@/services/cashflowProjection';

export default function CashflowProjection() {
  const { isAdmin, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [weeksToProject, setWeeksToProject] = useState<string>('8');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch cashflow projection
  const { data: projection, isLoading, error } = useQuery({
    queryKey: ['cashflow-projection', selectedUnitId, weeksToProject],
    queryFn: () => runCashflowProjection(
      selectedUnitId === 'all' ? undefined : selectedUnitId,
      parseInt(weeksToProject)
    ),
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.weeks.map(week => ({
      name: week.weekLabel,
      saldo: week.closingBalance,
      entradas: week.totalInflows,
      saidas: -week.totalOutflows,
    }));
  }, [projection]);

  const toggleWeekExpanded = (weekNumber: number) => {
    const newSet = new Set(expandedWeeks);
    if (newSet.has(weekNumber)) {
      newSet.delete(weekNumber);
    } else {
      newSet.add(weekNumber);
    }
    setExpandedWeeks(newSet);
  };

  const getStatusBadge = (status: CashflowWeek['status']) => {
    switch (status) {
      case 'POSITIVO':
        return <Badge variant="default" className="bg-green-500">Saudável</Badge>;
      case 'BAIXO':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Atenção</Badge>;
      case 'NEGATIVO':
        return <Badge variant="destructive">Negativo</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Projeção de Fluxo de Caixa
            </h1>
            <p className="text-muted-foreground">
              Previsão semanal de entradas e saídas baseada em dados reais
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

            <Select value={weeksToProject} onValueChange={setWeeksToProject}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 semanas</SelectItem>
                <SelectItem value="8">8 semanas</SelectItem>
                <SelectItem value="12">12 semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-80" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Erro ao carregar projeção de fluxo de caixa.
            </AlertDescription>
          </Alert>
        ) : projection ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Saldo Atual</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    {formatCurrency(projection.summary.currentBalance)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Entradas Previstas</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2 text-green-600">
                    <ArrowUp className="h-5 w-5" />
                    {formatCurrency(projection.summary.totalProjectedInflows)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Saídas Programadas</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2 text-red-600">
                    <ArrowDown className="h-5 w-5" />
                    {formatCurrency(projection.summary.totalProjectedOutflows)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className={projection.summary.finalProjectedBalance < 0 ? 'border-destructive' : ''}>
                <CardHeader className="pb-2">
                  <CardDescription>Saldo Projetado Final</CardDescription>
                  <CardTitle className={`text-2xl flex items-center gap-2 ${projection.summary.finalProjectedBalance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {projection.summary.finalProjectedBalance >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatCurrency(projection.summary.finalProjectedBalance)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Alerts */}
            {projection.summary.weeksWithNegativeBalance > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Alerta de Caixa Negativo</AlertTitle>
                <AlertDescription>
                  {projection.summary.weeksWithNegativeBalance} semana(s) com saldo projetado negativo. 
                  {projection.summary.firstNegativeWeek && (
                    <> Primeira ocorrência: <strong>{projection.summary.firstNegativeWeek.weekLabel}</strong> 
                    com saldo de <strong>{formatCurrency(projection.summary.firstNegativeWeek.closingBalance)}</strong>.</>
                  )}
                  {' '}Considere antecipar recebíveis ou renegociar pagamentos.
                </AlertDescription>
              </Alert>
            )}

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Evolução do Saldo</CardTitle>
                <CardDescription>
                  Projeção semanal do saldo de caixa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'saldo' ? 'Saldo' : name === 'entradas' ? 'Entradas' : 'Saídas'
                      ]}
                    />
                    <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                    <Area 
                      type="monotone" 
                      dataKey="saldo" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorSaldo)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Weekly Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento Semanal</CardTitle>
                <CardDescription>
                  Clique em uma semana para ver os itens detalhados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Semana</TableHead>
                      <TableHead className="text-right">Saldo Inicial</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Saídas</TableHead>
                      <TableHead className="text-right">Saldo Final</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.weeks.map((week) => (
                      <Collapsible key={week.weekNumber} asChild>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => toggleWeekExpanded(week.weekNumber)}
                                >
                                  {expandedWeeks.has(week.weekNumber) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">
                              {week.weekLabel}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(week.openingBalance)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              +{formatCurrency(week.totalInflows)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              -{formatCurrency(week.totalOutflows)}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${week.closingBalance < 0 ? 'text-destructive' : ''}`}>
                              {formatCurrency(week.closingBalance)}
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(week.status)}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-semibold text-green-600 mb-2 flex items-center gap-1">
                                      <ArrowUp className="h-4 w-4" /> Entradas ({week.expectedInflows.length})
                                    </h4>
                                    {week.expectedInflows.length > 0 ? (
                                      <ul className="space-y-1 text-sm">
                                        {week.expectedInflows.map(item => (
                                          <li key={item.id} className="flex justify-between">
                                            <span className="truncate max-w-[200px]">{item.description}</span>
                                            <span className="text-green-600">{formatCurrency(item.amount)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">Nenhuma entrada prevista</p>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-1">
                                      <ArrowDown className="h-4 w-4" /> Saídas ({week.scheduledOutflows.length})
                                    </h4>
                                    {week.scheduledOutflows.length > 0 ? (
                                      <ul className="space-y-1 text-sm">
                                        {week.scheduledOutflows.map(item => (
                                          <li key={item.id} className="flex justify-between">
                                            <span className="truncate max-w-[200px]">{item.description}</span>
                                            <span className="text-red-600">{formatCurrency(item.amount)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">Nenhuma saída programada</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
