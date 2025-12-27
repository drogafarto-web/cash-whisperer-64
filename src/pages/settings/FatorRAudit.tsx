import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  BarChart,
  Bar,
} from 'recharts';
import { Category, Unit } from '@/types/database';
import { auditFatorR, FatorRAuditResult } from '@/services/fatorRAudit';

export default function FatorRAudit() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Buscar unidades
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Buscar categorias
  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['categories-fator-r'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Buscar transações dos últimos 12 meses
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['fator-r-audit-transactions', selectedUnitId, selectedMonth],
    queryFn: async () => {
      const endDate = new Date(selectedMonth + '-01');
      const startDate = subMonths(endDate, 11);

      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          amount,
          type,
          category:categories(id, name, tax_group, entra_fator_r)
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

  // Processar auditoria
  const auditResult = useMemo<FatorRAuditResult | null>(() => {
    if (!transactionsData || !categories.length) return null;
    return auditFatorR(transactionsData as any, categories, selectedMonth);
  }, [transactionsData, categories, selectedMonth]);

  // Gerar opções de meses
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

  // Toggle entra_fator_r de uma categoria
  const handleToggleFatorR = async (categoryId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ entra_fator_r: !currentValue })
        .eq('id', categoryId);

      if (error) throw error;
      toast.success('Categoria atualizada!');
      refetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Erro ao atualizar categoria');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusColor = (fatorR: number) => {
    if (fatorR >= 0.28) return 'text-green-600';
    if (fatorR >= 0.25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (fatorR: number) => {
    if (fatorR >= 0.28) return <Badge className="bg-green-100 text-green-800">Anexo III</Badge>;
    if (fatorR >= 0.25) return <Badge className="bg-yellow-100 text-yellow-800">Margem</Badge>;
    return <Badge variant="destructive">Anexo V</Badge>;
  };

  // Filtrar categorias de PESSOAL
  const pessoalCategories = categories.filter(c => c.tax_group === 'PESSOAL' && c.active);

  if (authLoading || !user) {
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
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/accounting-panel')}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Painel
        </Button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Auditoria do Fator R
            </h1>
            <p className="text-muted-foreground">
              Valide a composição da folha para cálculo do Fator R
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

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : auditResult ? (
          <>
            {/* Cards de Resumo */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Fator R Médio (12 meses)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getStatusColor(auditResult.fatorRMedio)}`}>
                    {formatPercent(auditResult.fatorRMedio)}
                  </div>
                  <div className="mt-2">
                    {getStatusBadge(auditResult.fatorRMedio)}
                  </div>
                  <Progress 
                    value={Math.min(auditResult.fatorRMedio * 100 / 0.35, 100)} 
                    className="mt-2 h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Meta: ≥ 28% para Anexo III
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Folha 12 meses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(auditResult.folha12Total)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Salários + Pró-labore + Encargos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    RBT12 (Receita Bruta)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(auditResult.rbt12)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receita bruta dos últimos 12 meses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Categorias não Mapeadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${auditResult.categoriasNaoMapeadas.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {auditResult.categoriasNaoMapeadas.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditResult.categoriasNaoMapeadas.length > 0 
                      ? 'Verifique as categorias abaixo'
                      : 'Todas configuradas'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sugestões */}
            {auditResult.sugestoes.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Sugestões de Calibração</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    {auditResult.sugestoes.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Gráfico de Evolução */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Evolução do Fator R (12 meses)
                </CardTitle>
                <CardDescription>
                  Tendência do Fator R com linha de referência em 28% (limite Anexo III)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={auditResult.meses.map((m) => ({
                        mes: m.mesLabel,
                        fatorR: m.receita > 0 ? Number((m.fatorR * 100).toFixed(1)) : null,
                        folha: m.folhaTotal,
                        receita: m.receita,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="riskZone" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        domain={[0, 50]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-foreground">{data.mes}</p>
                                <div className="mt-2 space-y-1 text-sm">
                                  <p className={data.fatorR >= 28 ? 'text-green-600' : data.fatorR >= 25 ? 'text-yellow-600' : 'text-red-600'}>
                                    <span className="font-semibold">Fator R:</span> {data.fatorR?.toFixed(1) || '-'}%
                                  </p>
                                  <p className="text-muted-foreground">
                                    <span className="font-medium">Folha:</span> {formatCurrency(data.folha)}
                                  </p>
                                  <p className="text-muted-foreground">
                                    <span className="font-medium">Receita:</span> {formatCurrency(data.receita)}
                                  </p>
                                </div>
                                {data.fatorR !== null && (
                                  <p className={`mt-2 text-xs font-medium ${data.fatorR >= 28 ? 'text-green-600' : 'text-red-600'}`}>
                                    {data.fatorR >= 28 ? '✓ Anexo III' : '⚠ Anexo V'}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Zona de risco (abaixo de 28%) */}
                      <Area
                        type="monotone"
                        dataKey={() => 28}
                        fill="url(#riskZone)"
                        stroke="none"
                        fillOpacity={1}
                      />
                      {/* Linha de referência 28% */}
                      <ReferenceLine
                        y={28}
                        stroke="hsl(142, 76%, 36%)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: '28% (Anexo III)',
                          position: 'right',
                          fill: 'hsl(142, 76%, 36%)',
                          fontSize: 11,
                        }}
                      />
                      {/* Linha do Fator R */}
                      <Line
                        type="monotone"
                        dataKey="fatorR"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (payload.fatorR === null) return null;
                          const color = payload.fatorR >= 28 
                            ? 'hsl(142, 76%, 36%)' 
                            : payload.fatorR >= 25 
                              ? 'hsl(45, 93%, 47%)' 
                              : 'hsl(0, 84%, 60%)';
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill={color}
                              stroke="white"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 8, strokeWidth: 2 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground">≥ 28% (Anexo III)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-muted-foreground">25-28% (Margem)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-muted-foreground">&lt; 25% (Anexo V)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Barras Empilhadas - Composição da Folha */}
            <Card>
              <CardHeader>
                <CardTitle>Composição da Folha por Mês</CardTitle>
                <CardDescription>
                  Distribuição entre Salários, Pró-labore e Encargos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={auditResult.meses.map((m) => ({
                        mes: m.mesLabel,
                        salarios: m.folhaSalarios,
                        prolabore: m.folhaProlabore,
                        encargos: m.folhaEncargos,
                        total: m.folhaTotal,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickFormatter={(v) => 
                          v >= 1000 
                            ? `${(v / 1000).toFixed(0)}k` 
                            : v.toString()
                        }
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-foreground">{label}</p>
                                <div className="mt-2 space-y-1 text-sm">
                                  <p className="text-blue-600">
                                    <span className="font-medium">Salários:</span> {formatCurrency(payload[0]?.value as number || 0)}
                                  </p>
                                  <p className="text-green-600">
                                    <span className="font-medium">Pró-labore:</span> {formatCurrency(payload[1]?.value as number || 0)}
                                  </p>
                                  <p className="text-orange-600">
                                    <span className="font-medium">Encargos:</span> {formatCurrency(payload[2]?.value as number || 0)}
                                  </p>
                                  <hr className="my-1 border-border" />
                                  <p className="font-semibold">
                                    Total: {formatCurrency((payload[0]?.payload as any)?.total || 0)}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: 16 }}
                        formatter={(value) => {
                          const labels: Record<string, string> = {
                            salarios: 'Salários',
                            prolabore: 'Pró-labore',
                            encargos: 'Encargos',
                          };
                          return <span className="text-sm">{labels[value] || value}</span>;
                        }}
                      />
                      <Bar
                        dataKey="salarios"
                        name="salarios"
                        stackId="folha"
                        fill="hsl(var(--chart-1))"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="prolabore"
                        name="prolabore"
                        stackId="folha"
                        fill="hsl(var(--chart-2))"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="encargos"
                        name="encargos"
                        stackId="folha"
                        fill="hsl(var(--chart-3))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Evolução Mensal */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento Mensal</CardTitle>
                <CardDescription>
                  Composição da folha e Fator R mês a mês
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Salários</TableHead>
                      <TableHead className="text-right">Pró-labore</TableHead>
                      <TableHead className="text-right">Encargos</TableHead>
                      <TableHead className="text-right">Folha Total</TableHead>
                      <TableHead className="text-right">Não Fator R</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Fator R</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditResult.meses.map((m) => (
                      <TableRow key={m.mes}>
                        <TableCell className="font-medium">{m.mesLabel}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.folhaSalarios)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.folhaProlabore)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.folhaEncargos)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(m.folhaTotal)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(m.folhaNaoFatorR)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.receita)}</TableCell>
                        <TableCell className={`text-right font-bold ${getStatusColor(m.fatorR)}`}>
                          {m.receita > 0 ? formatPercent(m.fatorR) : '-'}
                        </TableCell>
                        <TableCell>
                          {m.receita > 0 ? getStatusBadge(m.fatorR) : <Badge variant="outline">Sem dados</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Configuração de Categorias */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Categorias de Pessoal</CardTitle>
                <CardDescription>
                  Defina quais categorias entram no cálculo do Fator R
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Recorrência</TableHead>
                      <TableHead className="text-center">Entra no Fator R</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pessoalCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma categoria de PESSOAL encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      pessoalCategories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
                          <TableCell>
                            {cat.recurrence_type === 'RECORRENTE' ? (
                              <Badge variant="outline" className="gap-1">
                                <RefreshCw className="w-3 h-3" /> Recorrente
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                Variável
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={cat.entra_fator_r}
                              onCheckedChange={() => handleToggleFatorR(cat.id, cat.entra_fator_r)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Referência Legal */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>O que entra na Folha do Fator R (LC 123)</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  <li><strong>Salários brutos</strong> - Remuneração dos funcionários</li>
                  <li><strong>13º salário</strong> - Décimo terceiro</li>
                  <li><strong>Férias</strong> - Remuneração de férias</li>
                  <li><strong>Pró-labore</strong> - Remuneração dos sócios</li>
                  <li><strong>INSS Patronal (CPP)</strong> - Contribuição patronal</li>
                  <li><strong>FGTS</strong> - Fundo de garantia</li>
                </ul>
                <p className="mt-3 text-sm">
                  <strong>NÃO entram:</strong> Vale transporte, vale alimentação, plano de saúde, 
                  distribuição de lucros, adiantamentos, reembolsos.
                </p>
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Selecione um período para visualizar a auditoria do Fator R
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
