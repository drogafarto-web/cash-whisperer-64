import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Barcode,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface TodayTransaction {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  category_name: string;
}

interface DailyTask {
  id: string;
  label: string;
  completed: boolean;
  link?: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}

export function AttendantDashboard() {
  const { unit, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [expectedBalance, setExpectedBalance] = useState(0);
  const [pendingClosing, setPendingClosing] = useState(true);
  const [todayTransactions, setTodayTransactions] = useState<TodayTransaction[]>([]);
  const [todayEntradas, setTodayEntradas] = useState(0);
  const [todaySaidas, setTodaySaidas] = useState(0);
  const [hasLisImport, setHasLisImport] = useState(false);
  const [pendingBoletosCount, setPendingBoletosCount] = useState(0);

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

      // Fetch today's LIS import
      const { data: lisClosures } = await supabase
        .from('lis_closures')
        .select('id')
        .eq('unit_id', unit.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .limit(1);

      setHasLisImport((lisClosures?.length ?? 0) > 0);

      // Fetch pending boletos count
      const { count: boletosCount } = await supabase
        .from('payables')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unit.id)
        .eq('status', 'pendente');

      setPendingBoletosCount(boletosCount ?? 0);

      // Fetch expected balance from cash account
      const { data: cashAccount } = await supabase
        .from('accounts')
        .select('id, initial_balance')
        .eq('unit_id', unit.id)
        .eq('type', 'caixa')
        .maybeSingle();

      let balance = cashAccount?.initial_balance || 0;

      if (cashAccount) {
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

  const dailyTasks: DailyTask[] = [
    {
      id: 'lis-import',
      label: 'Importar movimento LIS',
      completed: hasLisImport,
      link: '/import/daily-movement',
      icon: <FileUp className="h-4 w-4" />,
      priority: 'high',
    },
    {
      id: 'cash-closing',
      label: 'Fechar caixa do dia',
      completed: !pendingClosing,
      link: '/cash-closing',
      icon: <ClipboardCheck className="h-4 w-4" />,
      priority: 'high',
    },
    {
      id: 'check-boletos',
      label: `Verificar boletos pendentes${pendingBoletosCount > 0 ? ` (${pendingBoletosCount})` : ''}`,
      completed: pendingBoletosCount === 0,
      link: '/payables/boletos',
      icon: <Barcode className="h-4 w-4" />,
      priority: 'medium',
    },
  ];

  const completedTasks = dailyTasks.filter(t => t.completed).length;
  const totalTasks = dailyTasks.length;

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
      {/* Header com saudação */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Bom dia{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground">
          {unit?.name || 'Sua unidade'} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Alerta de fechamento pendente - mais chamativo */}
      {pendingClosing && (
        <div className="mb-6 p-4 bg-warning/15 border-2 border-warning/40 rounded-lg flex items-center gap-3">
          <div className="p-2 rounded-full bg-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-warning">Fechamento de caixa pendente</p>
            <p className="text-sm text-muted-foreground">O caixa de hoje ainda não foi fechado.</p>
          </div>
          <Button asChild size="sm" className="bg-warning hover:bg-warning/90 text-warning-foreground">
            <Link to="/cash-closing">Fazer agora</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Checklist de Tarefas Diárias */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Passos de Hoje
              </CardTitle>
              <Badge 
                variant={completedTasks === totalTasks ? "default" : "secondary"}
                className={completedTasks === totalTasks ? "bg-green-500" : ""}
              >
                {completedTasks}/{totalTasks} concluídos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {dailyTasks.map((task) => (
              <div 
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  task.completed 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : task.priority === 'high'
                    ? 'bg-warning/5 border-warning/20'
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  task.completed 
                    ? 'bg-green-500/10 text-green-600' 
                    : task.priority === 'high'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {task.completed ? <CheckCircle2 className="h-4 w-4" /> : task.icon}
                </div>
                
                <span className={`flex-1 ${task.completed ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                  {task.label}
                </span>

                {!task.completed && task.link && (
                  <Button asChild size="sm" variant={task.priority === 'high' ? 'default' : 'outline'}>
                    <Link to={task.link}>Fazer</Link>
                  </Button>
                )}
                
                {task.completed && (
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                    ✓ Feito
                  </Badge>
                )}
              </div>
            ))}

            {/* Progresso visual */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progresso do dia</span>
                <span className="font-medium">{Math.round((completedTasks / totalTasks) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Status do Caixa - mais compacto */}
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
              <p className="text-sm text-muted-foreground">Saldo esperado</p>
            </div>

            <div className="flex items-center gap-2">
              {pendingClosing ? (
                <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                  ⏳ Pendente
                </Badge>
              ) : (
                <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                  ✓ Fechado
                </Badge>
              )}
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                  <span className="text-muted-foreground">Entradas hoje</span>
                </div>
                <span className="font-medium text-green-600">{formatCurrency(todayEntradas)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                  <span className="text-muted-foreground">Saídas hoje</span>
                </div>
                <span className="font-medium text-destructive">{formatCurrency(todaySaidas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas - mais proeminente */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/payables/boletos">
              <Barcode className="h-5 w-5" />
              <span>Novo Boleto</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/transactions">
              <Plus className="h-5 w-5" />
              <span>Nova Transação</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/cash-closing">
              <ClipboardCheck className="h-5 w-5" />
              <span>Fechar Caixa</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/import/daily-movement">
              <FileUp className="h-5 w-5" />
              <span>Importar LIS</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Transações Recentes - colapsada */}
      {todayTransactions.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transações de Hoje</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/transactions">Ver todas →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {tx.type === 'ENTRADA' ? (
                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm truncate max-w-[200px]">{tx.description}</span>
                  </div>
                  <span className={`text-sm font-medium ${tx.type === 'ENTRADA' ? 'text-green-600' : 'text-destructive'}`}>
                    {tx.type === 'ENTRADA' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
