import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ClipboardCheck,
  FileUp,
  AlertTriangle,
} from 'lucide-react';

interface TodayTransaction {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  category_name: string;
}

export function AttendantDashboard() {
  const { unit, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [expectedBalance, setExpectedBalance] = useState(0);
  const [pendingClosing, setPendingClosing] = useState(true);
  const [todayTransactions, setTodayTransactions] = useState<TodayTransaction[]>([]);
  const [todayEntradas, setTodayEntradas] = useState(0);
  const [todaySaidas, setTodaySaidas] = useState(0);

  useEffect(() => {
    fetchAttendantData();
  }, [unit]);

  const fetchAttendantData = async () => {
    if (!unit?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch today's cash closing
      const { data: todayClosing } = await supabase
        .from('cash_closings')
        .select('*')
        .eq('unit_id', unit.id)
        .eq('date', today)
        .maybeSingle();

      setPendingClosing(!todayClosing);

      // Fetch expected balance from cash account
      const { data: cashAccount } = await supabase
        .from('accounts')
        .select('id, initial_balance')
        .eq('unit_id', unit.id)
        .eq('type', 'caixa')
        .maybeSingle();

      let balance = cashAccount?.initial_balance || 0;

      if (cashAccount) {
        // Calculate balance from all approved transactions
        const { data: allTx } = await supabase
          .from('transactions')
          .select('amount, type')
          .eq('account_id', cashAccount.id)
          .eq('status', 'APROVADO')
          .is('deleted_at', null);

        if (allTx) {
          allTx.forEach((tx) => {
            if (tx.type === 'ENTRADA') {
              balance += Math.abs(Number(tx.amount));
            } else {
              balance -= Math.abs(Number(tx.amount));
            }
          });
        }
      }

      setExpectedBalance(balance);

      // Fetch today's transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('id, description, amount, type, category:categories(name)')
        .eq('unit_id', unit.id)
        .eq('date', today)
        .eq('status', 'APROVADO')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txData) {
        const transactions: TodayTransaction[] = txData.map((tx: any) => ({
          id: tx.id,
          description: tx.description || tx.category?.name || 'Sem descrição',
          amount: Math.abs(Number(tx.amount)),
          type: tx.type,
          category_name: tx.category?.name || '',
        }));
        setTodayTransactions(transactions);

        const entradas = txData
          .filter((tx: any) => tx.type === 'ENTRADA')
          .reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);
        const saidas = txData
          .filter((tx: any) => tx.type === 'SAIDA')
          .reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

        setTodayEntradas(entradas);
        setTodaySaidas(saidas);
      }
    } catch (error) {
      console.error('Error fetching attendant data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Meu Dia</h1>
        <p className="text-muted-foreground">
          Unidade: {unit?.name || 'Não definida'} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Alerta de fechamento pendente */}
      {pendingClosing && (
        <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning">Fechamento de caixa pendente</p>
            <p className="text-sm text-muted-foreground">O caixa de hoje ainda não foi fechado.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-warning text-warning hover:bg-warning/10">
            <Link to="/cash-closing">Fazer agora</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Status do Caixa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              Caixa Dinheiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{formatCurrency(expectedBalance)}</p>
              <p className="text-sm text-muted-foreground">Saldo esperado (sistema)</p>
            </div>

            <div className="flex items-center gap-2">
              {pendingClosing ? (
                <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                  Pendente
                </Badge>
              ) : (
                <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                  Fechado hoje
                </Badge>
              )}
            </div>

            <Button asChild className="w-full">
              <Link to="/cash-closing">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Fazer Fechamento
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Transações de Hoje */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transações Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Entradas</span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(todayEntradas)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Saídas</span>
              </div>
              <span className="font-semibold text-destructive">{formatCurrency(todaySaidas)}</span>
            </div>

            <div className="border-t pt-3 space-y-2 max-h-[140px] overflow-y-auto">
              {todayTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma transação hoje
                </p>
              ) : (
                todayTransactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[140px]">{tx.description}</span>
                    <span className={tx.type === 'ENTRADA' ? 'text-green-600' : 'text-destructive'}>
                      {tx.type === 'ENTRADA' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to="/transactions">Ver Todas</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Ações Rápidas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start">
              <Link to="/transactions">
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/cash-closing">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Fechamento de Caixa
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/import/daily-movement">
                <FileUp className="h-4 w-4 mr-2" />
                Importar Movimento
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
