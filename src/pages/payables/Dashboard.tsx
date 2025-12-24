import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CreditCard,
  AlertTriangle,
  Calendar,
  TrendingDown,
  Clock,
  ArrowRight,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UnitSelector } from '@/components/UnitSelector';
import { useAuth } from '@/hooks/useAuth';
import { usePayablesDashboard, usePayablesMonthlyHistory } from '@/features/payables/hooks/usePayablesDashboard';

export default function PayablesDashboard() {
  const { isAdmin, unit: userUnit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>(userUnit?.id || '');

  const effectiveUnitId = isAdmin ? selectedUnitId || undefined : userUnit?.id;

  const { data: summary, isLoading } = usePayablesDashboard(effectiveUnitId);
  const { data: monthlyHistory, isLoading: loadingHistory } = usePayablesMonthlyHistory(effectiveUnitId, 6);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Dashboard de Contas a Pagar
            </h1>
            <p className="text-muted-foreground">
              Visão geral de vencimentos e fluxo de caixa
            </p>
          </div>

          {isAdmin && (
            <div className="w-full sm:w-64">
              <UnitSelector
                value={selectedUnitId}
                onChange={setSelectedUnitId}
                placeholder="Todas as unidades"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Overdue */}
              <Card className={summary?.overdue.count ? 'border-destructive/50 bg-destructive/5' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">
                        {formatCurrency(summary?.overdue.total || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary?.overdue.count || 0} vencido(s)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next 7 days */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-warning/10">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formatCurrency(summary?.next7Days.total || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary?.next7Days.count || 0} em 7 dias
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next 15 days */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formatCurrency(summary?.next15Days.total || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary?.next15Days.count || 0} em 15 dias
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next 30 days */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <TrendingDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formatCurrency(summary?.next30Days.total || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary?.next30Days.count || 0} em 30 dias
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Vencimentos por Semana
                  </CardTitle>
                  <CardDescription>Próximas 6 semanas</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary?.weeklyData && summary.weeklyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={summary.weeklyData}>
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Total']}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {summary.weeklyData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      Nenhum vencimento nas próximas semanas
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Vencendo Hoje/Amanhã
                    </span>
                    <Badge variant="secondary">{summary?.upcoming?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary?.upcoming && summary.upcoming.length > 0 ? (
                    <div className="space-y-3">
                      {summary.upcoming.slice(0, 5).map((payable) => (
                        <div
                          key={payable.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{payable.beneficiario}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(payable.vencimento), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                          </div>
                          <p className="font-bold">
                            {formatCurrency(payable.valor)}
                          </p>
                        </div>
                      ))}
                      {summary.upcoming.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{summary.upcoming.length - 5} outros
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Calendar className="h-12 w-12 mb-2 opacity-50" />
                      <p>Nenhum vencimento hoje/amanhã</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Evolution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Evolução: Pagos vs Vencidos
                </CardTitle>
                <CardDescription>Últimos 6 meses - Comparativo de gestão de pagamentos</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : monthlyHistory && monthlyHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyHistory} barGap={4}>
                      <XAxis 
                        dataKey="month" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'pagos' ? 'Pagos' : 'Vencidos/Pendentes'
                        ]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend 
                        formatter={(value) => value === 'pagos' ? 'Pagos' : 'Vencidos/Pendentes'}
                      />
                      <Bar 
                        dataKey="pagos" 
                        fill="hsl(142, 76%, 36%)" 
                        radius={[4, 4, 0, 0]} 
                        name="pagos"
                      />
                      <Bar 
                        dataKey="vencidos" 
                        fill="hsl(0, 84%, 60%)" 
                        radius={[4, 4, 0, 0]} 
                        name="vencidos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Nenhum dado histórico disponível
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overdue List */}
            {summary?.overdue.items && summary.overdue.items.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Boletos Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.overdue.items.map((payable) => (
                      <div
                        key={payable.id}
                        className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{payable.beneficiario}</p>
                          <p className="text-sm text-muted-foreground">
                            Venceu em {format(new Date(payable.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <p className="font-bold text-destructive">
                          {formatCurrency(payable.valor)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4">
              <Button asChild variant="outline">
                <Link to="/payables/boletos" className="flex items-center gap-2">
                  Ver Todos os Boletos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/payables/reconciliation" className="flex items-center gap-2">
                  Conciliação
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/payables/supplier-invoices" className="flex items-center gap-2">
                  Notas de Fornecedor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
