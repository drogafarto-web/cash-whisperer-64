import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Barcode,
  FileText,
  GitMerge,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  Loader2,
} from 'lucide-react';

interface PayablesSummary {
  vencidos: number;
  vencidosValor: number;
  proximos7dias: number;
  proximos7diasValor: number;
  pagosMes: number;
  pagosMesValor: number;
}

interface PendingSuggestions {
  count: number;
}

export function FinanceiroDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<PayablesSummary>({
    vencidos: 0,
    vencidosValor: 0,
    proximos7dias: 0,
    proximos7diasValor: 0,
    pagosMes: 0,
    pagosMesValor: 0,
  });
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestions>({ count: 0 });

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const todayStart = format(startOfDay(now), 'yyyy-MM-dd');
      const in7days = format(addDays(now, 7), 'yyyy-MM-dd');
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

      // Fetch vencidos
      const { data: vencidos } = await supabase
        .from('payables')
        .select('valor')
        .eq('status', 'pendente')
        .lt('vencimento', todayStart);

      // Fetch próximos 7 dias
      const { data: proximos } = await supabase
        .from('payables')
        .select('valor')
        .eq('status', 'pendente')
        .gte('vencimento', todayStart)
        .lte('vencimento', in7days);

      // Fetch pagos no mês
      const { data: pagos } = await supabase
        .from('payables')
        .select('paid_amount')
        .eq('status', 'pago')
        .gte('paid_at', monthStart);

      // Fetch pending matches
      const { data: pending } = await supabase
        .from('payables')
        .select('id')
        .eq('status', 'pendente')
        .not('matched_bank_item_id', 'is', null);

      setSummary({
        vencidos: vencidos?.length || 0,
        vencidosValor: vencidos?.reduce((sum, p) => sum + Number(p.valor), 0) || 0,
        proximos7dias: proximos?.length || 0,
        proximos7diasValor: proximos?.reduce((sum, p) => sum + Number(p.valor), 0) || 0,
        pagosMes: pagos?.length || 0,
        pagosMesValor: pagos?.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0) || 0,
      });

      setPendingSuggestions({ count: pending?.length || 0 });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const quickActions = [
    {
      title: 'Novo Boleto',
      description: 'Cadastrar boleto a pagar',
      icon: Barcode,
      href: '/payables/boletos',
      primary: true,
    },
    {
      title: 'Nota Fornecedor',
      description: 'Subir NF de compra',
      icon: FileText,
      href: '/payables/supplier-invoices',
    },
    {
      title: 'Conciliação',
      description: 'Vincular pagamentos',
      icon: GitMerge,
      href: '/payables/reconciliation',
    },
    {
      title: 'Extrato',
      description: 'Importar extrato bancário',
      icon: TrendingUp,
      href: '/import/bank-statement',
    },
  ];

  if (isLoading) {
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
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm capitalize">{today}</p>
          <h1 className="text-2xl font-bold">
            {greeting}, {profile?.name?.split(' ')[0] || 'Financeiro'}!
          </h1>
          <p className="text-muted-foreground">
            Gerencie contas a pagar, conciliações e extratos bancários.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Vencidos */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              summary.vencidos > 0 ? 'border-red-500/50 bg-red-500/5' : ''
            }`}
            onClick={() => navigate('/payables/boletos?status=vencido')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${summary.vencidos > 0 ? 'bg-red-500/10' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-5 w-5 ${summary.vencidos > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                </div>
                {summary.vencidos > 0 && (
                  <Badge variant="destructive">{summary.vencidos}</Badge>
                )}
              </div>
              <h3 className="font-semibold mb-1">Boletos Vencidos</h3>
              <p className={`text-2xl font-bold ${summary.vencidos > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {formatCurrency(summary.vencidosValor)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.vencidos} boleto(s)
              </p>
            </CardContent>
          </Card>

          {/* Próximos 7 dias */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              summary.proximos7dias > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''
            }`}
            onClick={() => navigate('/payables/boletos?status=proximo')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${summary.proximos7dias > 0 ? 'bg-yellow-500/10' : 'bg-muted'}`}>
                  <Clock className={`h-5 w-5 ${summary.proximos7dias > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                </div>
                {summary.proximos7dias > 0 && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">{summary.proximos7dias}</Badge>
                )}
              </div>
              <h3 className="font-semibold mb-1">Vence em 7 dias</h3>
              <p className={`text-2xl font-bold ${summary.proximos7dias > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                {formatCurrency(summary.proximos7diasValor)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.proximos7dias} boleto(s)
              </p>
            </CardContent>
          </Card>

          {/* Pagos no mês */}
          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => navigate('/payables/boletos?status=pago')}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <Badge variant="default" className="bg-green-500">{summary.pagosMes}</Badge>
              </div>
              <h3 className="font-semibold mb-1">Pagos este mês</h3>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.pagosMesValor)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.pagosMes} boleto(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Conciliation Alert */}
        {pendingSuggestions.count > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <GitMerge className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Conciliação Pendente</h3>
                    <p className="text-sm text-muted-foreground">
                      {pendingSuggestions.count} boleto(s) com sugestão de match aguardando confirmação
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate('/payables/reconciliation')}>
                  Iniciar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.href}
                variant={action.primary ? 'default' : 'outline'}
                className="h-auto py-4 flex-col items-start text-left justify-start gap-2"
                onClick={() => navigate(action.href)}
              >
                <div className="flex items-center gap-2 w-full">
                  <action.icon className="h-5 w-5" />
                  <span className="font-medium">{action.title}</span>
                </div>
                <span className="text-xs opacity-70 font-normal">{action.description}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Acesse a lista de boletos para ver os próximos vencimentos</p>
              <Button variant="link" onClick={() => navigate('/payables/boletos')}>
                Ver boletos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
