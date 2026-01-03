import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountingProcessingCard } from './AccountingProcessingCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Receipt, 
  TrendingUp, 
  FileText, 
  Wallet, 
  FileUp, 
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Paperclip,
  Sparkles,
  Calculator,
  FileSpreadsheet,
  Building2,
  PieChart,
  BarChart3,
  Rocket,
  Banknote,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompetenceData, useLabSubmission, useLabDocuments, useCompetenceDocuments } from '@/hooks/useAccountingCompetence';
import { useBillingSummary } from '@/features/billing';
import { useAccountingCashMovement } from '@/hooks/useAccountingCashMovement';
import { TodayActivityCard } from '@/components/shared/TodayActivityCard';
import { useDayActivity } from '@/hooks/useDayActivity';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AccountingSection = 'folha' | 'impostos' | 'receitas';

interface AccountingKioskHomeProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  onViewData: (section: AccountingSection) => void;
  onSendDocuments: () => void;
  onSmartUpload: () => void;
  isAccountingRole?: boolean;
}

interface QuickAccessCard {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  path: string;
}

function StatusBadge({ status }: { status: 'pendente' | 'informado' | 'confirmado' | 'rascunho' | 'enviado' | 'recebido' }) {
  const config = {
    pendente: { label: 'Pendente', variant: 'outline' as const, icon: Clock },
    informado: { label: 'Informado', variant: 'default' as const, icon: CheckCircle2 },
    confirmado: { label: 'Confirmado', variant: 'default' as const, icon: CheckCircle2 },
    rascunho: { label: 'Rascunho', variant: 'outline' as const, icon: AlertCircle },
    enviado: { label: 'Enviado', variant: 'default' as const, icon: Send },
    recebido: { label: 'Recebido', variant: 'default' as const, icon: CheckCircle2 },
  };
  
  const { label, variant, icon: Icon } = config[status];
  
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function AccountingKioskHome({ 
  unitId, 
  unitName, 
  competence, 
  onViewData, 
  onSendDocuments,
  onSmartUpload,
  isAccountingRole = true,
}: AccountingKioskHomeProps) {
  const navigate = useNavigate();
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  const monthParam = `${ano}-${String(mes).padStart(2, '0')}`;
  
  const { data: competenceData, isLoading: loadingData } = useCompetenceData(unitId, ano, mes);
  const { data: submission, isLoading: loadingSubmission } = useLabSubmission(unitId, ano, mes);
  const { data: documents = [] } = useLabDocuments(submission?.id || null);
  const { data: competenceDocuments = [] } = useCompetenceDocuments(unitId, ano, mes);
  
  // Movimento de caixa - dados agregados da central de fechamento
  const { data: cashMovement, isLoading: loadingCashMovement } = useAccountingCashMovement(unitId, ano, mes);
  
  // Faturamento - dados reais das invoices (não dados manuais de accounting_competence_data)
  const { data: billingSummary } = useBillingSummary(ano, mes, unitId || undefined);
  
  // Atividades do dia (lançamentos fiscais)
  const { data: activity, isLoading: loadingActivity } = useDayActivity(unitId, 'contabilidade');
  
  // Funcionários cadastrados para a unidade
  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios-unidade', unitId],
    queryFn: async () => {
      if (!unitId) return null;
      const { data } = await supabase
        .from('partners')
        .select('id, name, expected_amount')
        .eq('unit_id', unitId)
        .eq('type', 'FUNCIONARIO')
        .eq('active', true)
        .not('expected_amount', 'is', null);
      
      return {
        count: data?.length || 0,
        total: data?.reduce((sum, f) => sum + (f.expected_amount || 0), 0) || 0,
      };
    },
    enabled: !!unitId,
  });

  // Payables de folha criados para a competência (busca soma real dos títulos criados)
  const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const endDate = `${ano}-${String(mes).padStart(2, '0')}-31`;
  
  const { data: folhaPayablesData } = useQuery({
    queryKey: ['folha-payables', unitId, ano, mes],
    queryFn: async () => {
      if (!unitId) return null;
      
      const { data, error } = await supabase
        .from('payables')
        .select(`id, beneficiario, valor, category_id, categories!inner(tax_group)`)
        .eq('unit_id', unitId)
        .eq('tipo', 'titulo')
        .gte('vencimento', startDate)
        .lte('vencimento', endDate)
        .neq('status', 'CANCELADO');
      
      if (error) throw error;
      
      // Filtrar apenas categorias de folha (tax_group = 'PESSOAL')
      const folhaPayables = data?.filter((p: any) => p.categories?.tax_group === 'PESSOAL') || [];
      
      return {
        count: folhaPayables.length,
        total: folhaPayables.reduce((sum: number, p: any) => sum + (p.valor || 0), 0),
      };
    },
    enabled: !!unitId,
  });
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });
  
  const nfCount = documents.filter(d => d.tipo === 'nf').length;
  const despesaCount = documents.filter(d => d.tipo === 'despesa').length;
  const extratoCount = documents.filter(d => d.tipo === 'extrato_bancario').length;

  // Quick access navigation cards
  const quickAccessCards: QuickAccessCard[] = [
    {
      title: 'Impostos do Mês',
      description: 'Cenários tributários e simulações',
      icon: Calculator,
      iconColor: 'text-orange-500',
      path: `/reports/tax-scenarios?month=${monthParam}`,
    },
    {
      title: 'Folha de Pagamento',
      description: 'Base fiscal e dados de folha',
      icon: Users,
      iconColor: 'text-blue-500',
      path: `/settings/fiscal-base?tab=folha&month=${monthParam}`,
    },
    {
      title: 'NFs Fornecedores',
      description: 'Notas fiscais de compras',
      icon: FileSpreadsheet,
      iconColor: 'text-purple-500',
      path: `/payables/supplier-invoices?month=${monthParam}`,
    },
    {
      title: 'NFs Clientes / Faturamento',
      description: 'Resumo de faturamento e notas',
      icon: Building2,
      iconColor: 'text-green-500',
      path: `/billing/summary?month=${monthParam}`,
    },
    {
      title: 'Fator R / Anexos',
      description: 'Análise de Fator R e anexos do Simples',
      icon: PieChart,
      iconColor: 'text-red-500',
      path: `/reports/tax-scenarios?month=${monthParam}#fator-r`,
    },
    {
      title: 'Fluxo de Caixa',
      description: 'Projeção e movimentação de caixa',
      icon: BarChart3,
      iconColor: 'text-teal-500',
      path: `/reports/cashflow-projection?month=${monthParam}`,
    },
  ];

  // Count attachments by category and check OCR status
  const { attachmentCounts, ocrStats } = useMemo(() => {
    const counts = { folha: 0, impostos: 0, receitas: 0 };
    const ocr = { total: 0, processed: 0 };
    
    competenceDocuments.forEach(doc => {
      if (doc.categoria === 'folha') counts.folha++;
      else if (['das', 'darf', 'gps', 'inss', 'fgts', 'iss'].includes(doc.categoria)) {
        counts.impostos++;
        ocr.total++;
        if (doc.ocr_status === 'processado') ocr.processed++;
      }
      else if (doc.categoria === 'receitas') counts.receitas++;
    });
    
    return { attachmentCounts: counts, ocrStats: ocr };
  }, [competenceDocuments]);

  if (!unitId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione uma unidade para continuar</p>
      </div>
    );
  }

  if (loadingData || loadingSubmission) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Competência</p>
            <p className="text-xl font-semibold capitalize">{competenceLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Unidade</p>
            <p className="text-xl font-semibold">{unitName}</p>
          </div>
        </div>
      </div>

      {/* Card de Processamento Inteligente no topo */}
      <AccountingProcessingCard onProcess={onSmartUpload} />

      {/* Quick Access Section */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Rocket className="h-5 w-5 text-primary" />
          🚀 Acesso Rápido
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickAccessCards.map((card) => (
            <Card 
              key={card.title}
              className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group min-h-[120px]"
              onClick={() => navigate(card.path)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <card.icon className={`h-5 w-5 ${card.iconColor} group-hover:scale-110 transition-transform`} />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              📋 Contabilidade Informa
            </h2>
          </div>
          <StatusBadge status={competenceData?.status || 'pendente'} />
        </div>
        
        {/* Grid com 2 colunas - apenas Folha e Impostos (dados da contabilidade) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={`transition-colors ${isAccountingRole ? 'hover:border-primary/50 cursor-pointer' : ''}`} onClick={isAccountingRole ? () => onViewData('folha') : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Folha
                {attachmentCounts.folha > 0 && (
                  <Badge variant="outline" className="gap-1 ml-auto text-xs">
                    <Paperclip className="h-3 w-3" />{attachmentCounts.folha}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(folhaPayablesData?.total || competenceData?.total_folha || 0)}</p>
              <div className="mt-2 space-y-1">
                {funcionariosData && funcionariosData.count > 0 ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                      {funcionariosData.count} funcionário(s) cadastrado(s)
                    </Badge>
                    <span className="text-muted-foreground">
                      = {formatCurrency(funcionariosData.total)}
                    </span>
                  </div>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 text-xs">
                    Nenhum funcionário cadastrado
                  </Badge>
                )}
                {competenceData?.num_funcionarios !== undefined && competenceData.num_funcionarios > 0 && competenceData.num_funcionarios !== funcionariosData?.count && (
                  <p className="text-xs text-muted-foreground">
                    Informado: {competenceData.num_funcionarios} funcionários
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`transition-colors ${isAccountingRole ? 'hover:border-primary/50 cursor-pointer' : ''}`} onClick={isAccountingRole ? () => onViewData('impostos') : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-orange-500" />
                Impostos
                {attachmentCounts.impostos > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Paperclip className="h-3 w-3" />{attachmentCounts.impostos}
                    </Badge>
                    {ocrStats.processed > 0 && (
                      <Badge variant="default" className="gap-1 text-xs bg-green-600">
                        <Sparkles className="h-3 w-3" />{ocrStats.processed}
                      </Badge>
                    )}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency((competenceData?.das_valor || 0) + (competenceData?.darf_valor || 0) + (competenceData?.gps_valor || 0) + (competenceData?.iss_valor || 0))}
              </p>
              <p className="text-xs text-muted-foreground">DAS + DARF + GPS + ISS</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            🧪 Laboratório Envia
          </h2>
          {submission && <StatusBadge status={submission.status} />}
        </div>

        {/* Grid com 5 colunas - dados que o laboratório envia para a contabilidade */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Faturamento / NFs Clientes - NFs emitidas pelo laboratório (dados reais das invoices) */}
          <Card 
            className="hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/billing/summary?month=${monthParam}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-500" />
                Faturamento / NFs Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(billingSummary?.invoicesTotal || 0)}</p>
              <p className="text-xs text-muted-foreground">
                {billingSummary?.invoicesByPayer?.length || 0} convênios/prefeituras
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-purple-500" />
                Comprovantes NFs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{nfCount}</p>
              <p className="text-xs text-muted-foreground">PDFs anexados p/ contabilidade</p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4 text-red-500" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{despesaCount}</p>
              <p className="text-xs text-muted-foreground">itens registrados</p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileUp className="h-4 w-4 text-teal-500" />
                Extrato Bancário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{extratoCount > 0 ? '✓' : '—'}</p>
              <p className="text-xs text-muted-foreground">{extratoCount > 0 ? 'Enviado' : 'Pendente'}</p>
            </CardContent>
          </Card>

          {/* Movimento de Caixa - dados da central de fechamento (lis_closures / lis_closure_items) */}
          <Card 
            className="hover:border-primary/50 transition-colors cursor-pointer border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
            onClick={() => navigate(`/reports/cashflow-projection?month=${monthParam}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Movimento de Caixa
                {cashMovement && cashMovement.closuresCount > 0 && (
                  <Badge variant="outline" className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-900">
                    {cashMovement.closuresCount} fech.
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCashMovement ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(cashMovement?.total || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Din {formatCurrency(cashMovement?.money || 0)} · PIX {formatCurrency(cashMovement?.pix || 0)} · Cart {formatCurrency(cashMovement?.card || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Card de Atividades Fiscais do Dia */}
      <div className="border-t pt-6">
        <TodayActivityCard
          items={activity?.items || []}
          total={activity?.total || 0}
          count={activity?.count || 0}
          isLoading={loadingActivity}
          title="Lançamentos Fiscais de Hoje"
        />
      </div>

      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onSendDocuments} className="gap-2" disabled={submission?.status === 'enviado' || submission?.status === 'recebido'}>
          <Send className="h-5 w-5" />
          {submission?.status === 'enviado' ? 'Documentos Enviados' : submission?.status === 'recebido' ? 'Documentos Recebidos' : 'Preparar Envio para Contabilidade'}
        </Button>
      </div>
    </div>
  );
}