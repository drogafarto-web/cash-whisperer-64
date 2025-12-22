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
} from 'lucide-react';
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

            {/* Tabela de Evolução Mensal */}
            <Card>
              <CardHeader>
                <CardTitle>Evolução Mensal do Fator R</CardTitle>
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
