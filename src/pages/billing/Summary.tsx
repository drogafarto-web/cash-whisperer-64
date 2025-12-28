import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Wallet, FileText, DollarSign, Building2, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBillingSummary } from '@/features/billing';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function BillingSummary() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  // Fetch units for filter
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: summary, isLoading } = useBillingSummary(
    selectedYear, 
    selectedMonth, 
    selectedUnit === 'all' ? undefined : selectedUnit
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const caixaChartData = summary ? [
    { name: 'Dinheiro', value: summary.caixaByMethod.dinheiro },
    { name: 'PIX', value: summary.caixaByMethod.pix },
    { name: 'Cartão', value: summary.caixaByMethod.cartao },
  ].filter(d => d.value > 0) : [];

  const compositionData = summary ? [
    { name: 'Caixa (Particulares)', value: summary.caixaTotal },
    { name: 'NFS-e (Convênios)', value: summary.invoicesTotal },
  ] : [];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resumo de Faturamento</h1>
            <p className="text-muted-foreground">
              Visão consolidada: Caixa + Notas Fiscais = 100% do faturamento
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {/* Main Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Caixa (Particulares)
                  </CardDescription>
                  <CardTitle className="text-3xl">
                    {formatCurrency(summary?.caixaTotal || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Dinheiro:</span>
                      <span>{formatCurrency(summary?.caixaByMethod.dinheiro || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PIX:</span>
                      <span>{formatCurrency(summary?.caixaByMethod.pix || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cartão:</span>
                      <span>{formatCurrency(summary?.caixaByMethod.cartao || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    NFS-e (Convênios/Prefeituras)
                  </CardDescription>
                  <CardTitle className="text-3xl">
                    {formatCurrency(summary?.invoicesTotal || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {summary?.invoicesByPayer.slice(0, 3).map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="truncate max-w-[150px]">{p.payerName}:</span>
                        <span>{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                    {(summary?.invoicesByPayer.length || 0) > 3 && (
                      <div className="text-muted-foreground">
                        + {summary!.invoicesByPayer.length - 3} outros
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Faturamento Total
                  </CardDescription>
                  <CardTitle className="text-3xl text-amber-700 dark:text-amber-400">
                    {formatCurrency(summary?.grandTotal || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {MONTHS.find(m => m.value === selectedMonth)?.label} / {selectedYear}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Caixa + NFS-e = 100% do faturamento
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Composition Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Composição do Faturamento</CardTitle>
                  <CardDescription>Caixa vs Notas Fiscais</CardDescription>
                </CardHeader>
                <CardContent>
                  {compositionData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={compositionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {compositionData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      Sem dados para exibir
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payers Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Faturamento por Convênio</CardTitle>
                  <CardDescription>Distribuição por tomador</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary?.invoicesByPayer && summary.invoicesByPayer.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={summary.invoicesByPayer.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis 
                          type="category" 
                          dataKey="payerName" 
                          width={120}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="total" fill="hsl(var(--chart-2))" name="Valor" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      Nenhuma nota fiscal no período
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Caixa Breakdown */}
            {caixaChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Caixa por Forma de Pagamento</CardTitle>
                  <CardDescription>Distribuição dos recebimentos particulares</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={caixaChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="hsl(var(--chart-1))" name="Valor" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
