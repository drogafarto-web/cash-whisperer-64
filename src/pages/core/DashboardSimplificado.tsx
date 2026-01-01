import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  Receipt,
  FileText,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { AttendantDashboard } from '@/components/dashboard/AttendantDashboard';
import { FinanceiroDashboard } from '@/components/dashboard/FinanceiroDashboard';
import { ContadorDashboard } from '@/components/dashboard/ContadorDashboard';

/**
 * Dashboard Simplificado - 4 cards essenciais
 * 
 * Fluxo: Receita → Despesa → Impostos → Lucro
 * 
 * Fonte de dados:
 * - Receita: transactions WHERE type = 'ENTRADA' AND status = 'APROVADO'
 * - Despesa: transactions WHERE type = 'SAIDA' AND status = 'APROVADO'
 * - Impostos: payables WHERE categoria IN ('DARF', 'GPS', 'DAS', 'FGTS')
 * - Lucro: Receita - Despesa - Impostos
 */
export default function DashboardSimplificado() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading, isSecretaria, isFinanceiro, isContador } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Dados do dashboard
  const [receita, setReceita] = useState(0);
  const [despesa, setDespesa] = useState(0);
  const [impostosPendentes, setImpostosPendentes] = useState(0);
  const [impostosPagos, setImpostosPagos] = useState(0);
  const [lucro, setLucro] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Renderizar dashboard específico por papel
  if (!authLoading && isSecretaria) {
    return <AttendantDashboard />;
  }

  if (!authLoading && isFinanceiro) {
    return <FinanceiroDashboard />;
  }

  if (!authLoading && isContador) {
    return <ContadorDashboard />;
  }

  // Fetch dados do mês atual
  useEffect(() => {
    if (user && (role === 'admin' || role === 'gestor_unidade')) {
      fetchDashboardData();
    }
  }, [user, role]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');

      // Buscar transações do mês
      const { data: txData } = await supabase
        .from('transactions')
        .select('type, amount')
        .gte('date', start)
        .lte('date', end)
        .eq('status', 'APROVADO')
        .is('deleted_at', null);

      if (txData) {
        const receitaTotal = txData
          .filter((t) => t.type === 'ENTRADA')
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        const despesaTotal = txData
          .filter((t) => t.type === 'SAIDA')
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        
        setReceita(receitaTotal);
        setDespesa(despesaTotal);
      }

      // Buscar guias tributárias pendentes
      const { data: guiasData } = await supabase
        .from('accounting_lab_documents')
        .select('valor, payable_status')
        .in('tipo', ['DARF', 'GPS', 'DAS', 'FGTS', 'INSS', 'ISS'])
        .gte('created_at', start);

      if (guiasData) {
        const pendentes = guiasData
          .filter((g) => g.payable_status !== 'paid')
          .reduce((sum, g) => sum + (g.valor || 0), 0);
        const pagos = guiasData
          .filter((g) => g.payable_status === 'paid')
          .reduce((sum, g) => sum + (g.valor || 0), 0);
        
        setImpostosPendentes(pendentes);
        setImpostosPagos(pagos);
      }

      // Calcular lucro estimado
      setLucro(receita - despesa - impostosPagos);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar lucro quando dados mudam
  useEffect(() => {
    setLucro(receita - despesa - impostosPagos);
  }, [receita, despesa, impostosPagos]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral de {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>

        {/* 4 Cards Essenciais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Receita */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Receita do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(receita)}
              </div>
              <Link to="/billing/invoices" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2">
                Ver faturamento <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Despesa */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Despesas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(despesa)}
              </div>
              <Link to="/payables/boletos" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2">
                Ver pagamentos <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Impostos */}
          <Card className={`border-l-4 ${impostosPendentes > 0 ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-500" />
                Impostos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${impostosPendentes > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                {formatCurrency(impostosPendentes)}
              </div>
              {impostosPendentes > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Guias a vencer
                </div>
              )}
              <Link to="/payables/tax-documents" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2">
                Ver guias <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Lucro */}
          <Card className={`border-l-4 ${lucro >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-500" />
                Lucro Estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(lucro)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Receita - Despesas - Impostos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            <CardDescription>Acesse as funcionalidades mais usadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/transactions">
                  <Receipt className="h-5 w-5" />
                  <span className="text-sm">Lançamentos</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/payables/boletos">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm">Boletos</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/payables/tax-documents">
                  <Calculator className="h-5 w-5" />
                  <span className="text-sm">Guias Fiscais</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/accounting-panel">
                  <Wallet className="h-5 w-5" />
                  <span className="text-sm">Contabilidade</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
