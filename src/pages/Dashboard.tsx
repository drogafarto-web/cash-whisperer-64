import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Account, Category } from '@/types/database';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  Clock, 
  FileDown,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface DashboardStats {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  pendentes: number;
}

interface CategoryData {
  name: string;
  entradas: number;
  saidas: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalEntradas: 0, totalSaidas: 0, saldo: 0, pendentes: 0 });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && role !== 'admin') {
      navigate('/transactions');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'admin') {
      fetchDashboardData();
    }
  }, [user, role, dateRange]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch approved transactions for the month
      const { data: txData } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(*),
          account:accounts(*)
        `)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
        .is('deleted_at', null);

      const typedTxData = (txData || []) as unknown as Transaction[];
      setTransactions(typedTxData);

      // Calculate stats
      const approved = typedTxData.filter(t => t.status === 'APROVADO');
      const entradas = approved.filter(t => t.type === 'ENTRADA').reduce((sum, t) => sum + Number(t.amount), 0);
      const saidas = approved.filter(t => t.type === 'SAIDA').reduce((sum, t) => sum + Number(t.amount), 0);
      const pendentes = typedTxData.filter(t => t.status === 'PENDENTE').length;

      setStats({
        totalEntradas: entradas,
        totalSaidas: saidas,
        saldo: entradas - saidas,
        pendentes,
      });

      // Calculate category breakdown
      const categoryMap = new Map<string, { entradas: number; saidas: number }>();
      approved.forEach(t => {
        const catName = t.category?.name || 'Sem categoria';
        const current = categoryMap.get(catName) || { entradas: 0, saidas: 0 };
        if (t.type === 'ENTRADA') {
          current.entradas += Number(t.amount);
        } else {
          current.saidas += Number(t.amount);
        }
        categoryMap.set(catName, current);
      });

      setCategoryData(
        Array.from(categoryMap.entries()).map(([name, data]) => ({
          name,
          ...data,
        }))
      );

      // Fetch accounts
      const { data: accountData } = await supabase.from('accounts').select('*').eq('active', true);
      setAccounts((accountData || []) as Account[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const month = format(dateRange.start, 'MMMM yyyy', { locale: ptBR });
    
    doc.setFontSize(18);
    doc.text(`Relatório Financeiro - ${month}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Total Entradas: R$ ${stats.totalEntradas.toFixed(2)}`, 20, 40);
    doc.text(`Total Saídas: R$ ${stats.totalSaidas.toFixed(2)}`, 20, 50);
    doc.text(`Saldo: R$ ${stats.saldo.toFixed(2)}`, 20, 60);
    
    doc.text('Transações Aprovadas:', 20, 80);
    let y = 90;
    transactions.filter(t => t.status === 'APROVADO').forEach((t, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const typeSymbol = t.type === 'ENTRADA' ? '+' : '-';
      doc.text(`${format(new Date(t.date), 'dd/MM/yyyy')} - ${typeSymbol} R$ ${Number(t.amount).toFixed(2)} - ${t.category?.name || 'N/A'}`, 20, y);
      y += 8;
    });
    
    doc.save(`relatorio_${format(dateRange.start, 'yyyy-MM')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const exportToExcel = () => {
    const data = transactions.map(t => ({
      'Data': format(new Date(t.date), 'dd/MM/yyyy'),
      'Tipo': t.type,
      'Valor': Number(t.amount),
      'Categoria': t.category?.name || '',
      'Conta': t.account?.name || '',
      'Forma de Pagamento': t.payment_method,
      'Status': t.status,
      'Descrição': t.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, `transacoes_${format(dateRange.start, 'yyyy-MM')}.xlsx`);
    toast.success('Excel exportado com sucesso!');
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {format(dateRange.start, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <FileDown className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entradas</CardTitle>
              <ArrowUpCircle className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">
                R$ {stats.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saídas</CardTitle>
              <ArrowDownCircle className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                R$ {stats.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stats.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {stats.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-warning">{stats.pendentes}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Entradas vs Saídas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Nenhuma transação aprovada no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Saldo por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(account => {
                const accountTx = transactions.filter(t => t.account_id === account.id && t.status === 'APROVADO');
                const balance = Number(account.initial_balance) +
                  accountTx.reduce((sum, t) => {
                    return sum + (t.type === 'ENTRADA' ? Number(t.amount) : -Number(t.amount));
                  }, 0);
                
                return (
                  <div key={account.id} className="p-4 rounded-lg border bg-card">
                    <p className="font-medium">{account.name}</p>
                    <p className={`text-lg font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
