import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { supabase } from '@/integrations/supabase/client';
import { Unit, Category, Transaction, Account, Profile } from '@/types/database';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CalendarIcon,
  FileSpreadsheet,
  FileText,
  TrendingDown,
  TrendingUp,
  Receipt,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  PieChart,
  Pie,
} from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface TransactionWithRelations extends Transaction {
  unit?: Unit;
  account?: Account;
  category?: Category;
  created_by_profile?: Profile;
}

interface CategorySummary {
  name: string;
  total: number;
  count: number;
  color: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
];

export default function TransactionsReport() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('APROVADO');
  const [selectedRecurrence, setSelectedRecurrence] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUnits();
      fetchCategories();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchTransactions();
    }
  }, [user, isAdmin, startDate, endDate, selectedUnitId, selectedCategoryId, selectedType, selectedStatus]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('active', true).order('name');
    setCategories((data || []) as Category[]);
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          unit:units(*),
          account:accounts!transactions_account_id_fkey(*),
          category:categories(*)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      if (selectedCategoryId !== 'all') {
        query = query.eq('category_id', selectedCategoryId);
      }

      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data: txData } = await query;

      if (txData && txData.length > 0) {
        const createdByIds = [...new Set(txData.map(t => t.created_by))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', createdByIds);

        const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

        const enrichedData = txData.map(tx => ({
          ...tx,
          created_by_profile: profilesMap.get(tx.created_by) as Profile | undefined,
        }));

        setTransactions(enrichedData as TransactionWithRelations[]);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by recurrence locally
  const filteredTransactions = selectedRecurrence === 'all' 
    ? transactions 
    : transactions.filter(t => t.category?.recurrence_type === selectedRecurrence);

  // Calculate summary stats
  const totalTransactions = filteredTransactions.length;
  const totalEntradas = filteredTransactions.filter(t => t.type === 'ENTRADA').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalSaidas = filteredTransactions.filter(t => t.type === 'SAIDA').reduce((sum, t) => sum + Number(t.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  // Calculate recurrence breakdown (always from full transactions, not filtered)
  const receitaRecorrente = transactions
    .filter(t => t.type === 'ENTRADA' && t.category?.recurrence_type === 'RECORRENTE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const receitaVariavel = transactions
    .filter(t => t.type === 'ENTRADA' && t.category?.recurrence_type === 'NAO_RECORRENTE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const despesaFixa = transactions
    .filter(t => t.type === 'SAIDA' && t.category?.recurrence_type === 'RECORRENTE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const despesaVariavel = transactions
    .filter(t => t.type === 'SAIDA' && t.category?.recurrence_type === 'NAO_RECORRENTE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Group by category for chart (use filtered transactions)
  const categorySummary: CategorySummary[] = categories
    .map((cat, index) => {
      const catTxs = filteredTransactions.filter(t => t.category_id === cat.id);
      return {
        name: cat.name,
        total: catTxs.reduce((sum, t) => sum + Number(t.amount), 0),
        count: catTxs.length,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.total - a.total);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text('Relatório de Transações', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(
      `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
      pageWidth / 2,
      28,
      { align: 'center' }
    );

    doc.setFontSize(12);
    doc.text('Resumo:', 14, 40);
    doc.setFontSize(10);
    doc.text(`Total de Transações: ${totalTransactions}`, 14, 48);
    doc.text(`Total Entradas: ${formatCurrency(totalEntradas)}`, 14, 54);
    doc.text(`Total Saídas: ${formatCurrency(totalSaidas)}`, 14, 60);
    doc.text(`Saldo: ${formatCurrency(saldo)}`, 14, 66);

    doc.setFontSize(12);
    doc.text('Breakdown por Recorrência:', 14, 76);
    doc.setFontSize(10);
    doc.text(`Receita Recorrente: ${formatCurrency(receitaRecorrente)}`, 14, 84);
    doc.text(`Receita Variável: ${formatCurrency(receitaVariavel)}`, 100, 84);
    doc.text(`Despesa Fixa: ${formatCurrency(despesaFixa)}`, 14, 90);
    doc.text(`Despesa Variável: ${formatCurrency(despesaVariavel)}`, 100, 90);

    let yPos = 100;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', 14, yPos);
    doc.text('Tipo', 35, yPos);
    doc.text('Categoria', 55, yPos);
    doc.text('Valor', 100, yPos);
    doc.text('Unidade', 130, yPos);
    doc.text('Descrição', 160, yPos);

    doc.setFont('helvetica', 'normal');
    yPos += 8;

    filteredTransactions.forEach(tx => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(format(parseISO(tx.date), 'dd/MM/yy'), 14, yPos);
      doc.text(tx.type === 'ENTRADA' ? 'Ent' : 'Saí', 35, yPos);
      doc.text((tx.category?.name || '—').slice(0, 15), 55, yPos);
      doc.text(formatCurrency(Number(tx.amount)), 100, yPos);
      doc.text((tx.unit?.code || '—').slice(0, 8), 130, yPos);
      doc.text((tx.description || '—').slice(0, 15), 160, yPos);
      yPos += 6;
    });

    doc.save(`relatorio-transacoes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = () => {
    const data = filteredTransactions.map(tx => ({
      Data: format(parseISO(tx.date), 'dd/MM/yyyy'),
      Tipo: tx.type === 'ENTRADA' ? 'Entrada' : 'Saída',
      Categoria: tx.category?.name || '—',
      Recorrência: tx.category?.recurrence_type === 'RECORRENTE' ? 'Recorrente' : 'Não Recorrente',
      Valor: Number(tx.amount),
      Unidade: tx.unit?.name || '—',
      Conta: tx.account?.name || '—',
      Status: tx.status,
      'Forma Pagamento': tx.payment_method,
      Descrição: tx.description || '—',
      'Criado por': tx.created_by_profile?.name || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, `relatorio-transacoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROVADO':
        return <Badge className="bg-success/20 text-success border-0">Aprovado</Badge>;
      case 'REJEITADO':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  if (authLoading || isLoading) {
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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório de Transações</h1>
            <p className="text-muted-foreground">Análise consolidada por período e categoria</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Unit Filter */}
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SAIDA">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="APROVADO">Aprovado</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="REJEITADO">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence Filter */}
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={selectedRecurrence} onValueChange={setSelectedRecurrence}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                    <SelectItem value="NAO_RECORRENTE">Não Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Receipt className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="text-2xl font-bold">{totalTransactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <ArrowUpCircle className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entradas</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(totalEntradas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <ArrowDownCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saídas</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-lg",
                  saldo >= 0 ? "bg-success/10" : "bg-destructive/10"
                )}>
                  <DollarSign className={cn(
                    "w-6 h-6",
                    saldo >= 0 ? "text-success" : "text-destructive"
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    saldo >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(saldo)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recurrence Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <RefreshCw className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Recorrente</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(receitaRecorrente)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Zap className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Variável</p>
                  <p className="text-xl font-bold text-emerald-500">{formatCurrency(receitaVariavel)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <RefreshCw className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesa Fixa</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(despesaFixa)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Zap className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesa Variável</p>
                  <p className="text-xl font-bold text-orange-500">{formatCurrency(despesaVariavel)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {categorySummary.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Valores por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categorySummary.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                      <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                        {categorySummary.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySummary.slice(0, 6)}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name.slice(0, 10)} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {categorySummary.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma transação encontrada no período
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(tx.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {tx.type === 'ENTRADA' ? (
                          <Badge className="bg-success/20 text-success border-0">
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/20 text-destructive border-0">
                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.category?.name || '—'}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        tx.type === 'ENTRADA' ? "text-success" : "text-destructive"
                      )}>
                        {formatCurrency(Number(tx.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.unit?.code || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.account?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tx.status)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {tx.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
