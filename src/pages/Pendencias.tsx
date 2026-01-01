import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePendingDetails } from '@/hooks/usePendingDetails';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Calculator, 
  Tags, 
  TrendingDown,
  ArrowRight,
  Building2,
  Scale,
  FileText,
  Gavel,
  CalendarClock,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useBankStatements, BANK_ACCOUNTS } from '@/hooks/useBankStatements';

function PendingCard({
  title,
  description,
  icon: Icon,
  count,
  status,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  count: number;
  status: 'ok' | 'warning' | 'critical';
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(
      "border-l-4",
      status === 'ok' && "border-l-green-500",
      status === 'warning' && "border-l-yellow-500",
      status === 'critical' && "border-l-destructive",
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              status === 'ok' && "bg-green-500/10 text-green-600",
              status === 'warning' && "bg-yellow-500/10 text-yellow-600",
              status === 'critical' && "bg-destructive/10 text-destructive",
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <Badge variant={status === 'ok' ? 'secondary' : status === 'warning' ? 'outline' : 'destructive'}>
            {count === 0 ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                OK
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {count} pendência{count !== 1 ? 's' : ''}
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

// Hook para buscar guias fiscais vencidas
function useOverdueTaxGuides() {
  return useQuery({
    queryKey: ['overdue-tax-guides'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('payables')
        .select('id, tipo, beneficiario, valor, vencimento, status')
        .in('tipo', ['das', 'darf', 'gps', 'inss', 'fgts', 'iss'])
        .eq('status', 'pendente')
        .lt('vencimento', today)
        .order('vencimento')
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para buscar contratos vencendo
function useExpiringContracts() {
  return useQuery({
    queryKey: ['expiring-contracts'],
    queryFn: async () => {
      const futureDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('patrimony_items')
        .select('id, descricao, tipo, data_vencimento, valor_atual')
        .eq('tipo', 'contrato')
        .gte('data_vencimento', today)
        .lte('data_vencimento', futureDate)
        .order('data_vencimento')
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function Pendencias() {
  const { user, role } = useAuth();
  const userId = user?.id || '';
  const { data, isLoading } = usePendingDetails();
  const { data: overdueTaxGuides = [], isLoading: loadingTaxGuides } = useOverdueTaxGuides();
  const { data: expiringContracts = [], isLoading: loadingContracts } = useExpiringContracts();
  
  // Hook para verificar extratos bancários pendentes
  const { files, loadFiles, checkMissingStatements } = useBankStatements({ userId });
  
  // Carregar arquivos para verificação
  useEffect(() => {
    if (role === 'admin') {
      loadFiles();
    }
  }, [role, loadFiles]);
  
  // Verificar se precisa mostrar lembrete de extratos (dias 1-5 do mês, só admin)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const showBankStatementReminder = role === 'admin' && dayOfMonth <= 5;
  const missingStatements = checkMissingStatements();

  // Contagens por aba
  const bankStatementPending = showBankStatementReminder && missingStatements.hasMissing ? 1 : 0;
  const fiscalCount = (data?.unidadesSemFechamento.length || 0) +
    (data?.unidadesSemTaxConfig.length || 0) +
    (data?.categoriasSemTaxGroup.length || 0) +
    (data?.fatorRStatus?.alertLevel !== 'ok' ? 1 : 0) +
    overdueTaxGuides.length +
    bankStatementPending;

  const contratualCount = expiringContracts.length;
  const legalCount = 0; // Placeholder para futuro

  const totalPendencias = fiscalCount + contratualCount + legalCount;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Resumo de Pendências</h1>
            <p className="text-muted-foreground">
              Visão consolidada de itens que precisam de atenção
            </p>
          </div>
          <Badge 
            variant={totalPendencias === 0 ? 'secondary' : 'destructive'} 
            className="text-lg px-4 py-1.5"
          >
            {totalPendencias} pendência{totalPendencias !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fiscal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fiscal" className="gap-2">
              <Calculator className="h-4 w-4" />
              Fiscal
              {fiscalCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {fiscalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contratual" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratual
              {contratualCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {contratualCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="legal" className="gap-2">
              <Gavel className="h-4 w-4" />
              Legal
              {legalCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {legalCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Aba Fiscal */}
          <TabsContent value="fiscal" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Fechamentos de Caixa */}
              <PendingCard
                title="Fechamentos de Caixa"
                description="Unidades sem fechamento hoje"
                icon={DollarSign}
                count={data?.unidadesSemFechamento.length || 0}
                status={!data?.unidadesSemFechamento.length ? 'ok' : 'critical'}
              >
                {data?.unidadesSemFechamento.length ? (
                  <div className="space-y-2">
                    {data.unidadesSemFechamento.slice(0, 5).map(unit => (
                      <div key={unit.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{unit.name}</span>
                          <span className="text-xs text-muted-foreground">({unit.code})</span>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/cash-closing">
                            Fechar <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {data.unidadesSemFechamento.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{data.unidadesSemFechamento.length - 5} unidades
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todas as unidades possuem fechamento de caixa hoje.
                  </p>
                )}
              </PendingCard>

              {/* Config Tributária */}
              <PendingCard
                title="Configuração Tributária"
                description="Unidades sem regime tributário definido"
                icon={Calculator}
                count={data?.unidadesSemTaxConfig.length || 0}
                status={!data?.unidadesSemTaxConfig.length ? 'ok' : 'critical'}
              >
                {data?.unidadesSemTaxConfig.length ? (
                  <div className="space-y-2">
                    {data.unidadesSemTaxConfig.slice(0, 5).map(unit => (
                      <div key={unit.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{unit.name}</span>
                          <span className="text-xs text-muted-foreground">({unit.code})</span>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/settings/tax-config">
                            Configurar <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {data.unidadesSemTaxConfig.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{data.unidadesSemTaxConfig.length - 5} unidades
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todas as unidades possuem configuração tributária.
                  </p>
                )}
              </PendingCard>

              {/* Categorias sem Tax Group */}
              <PendingCard
                title="Categorias sem Grupo Tributário"
                description="Categorias ativas sem classificação fiscal"
                icon={Tags}
                count={data?.categoriasSemTaxGroup.length || 0}
                status={!data?.categoriasSemTaxGroup.length ? 'ok' : 'warning'}
              >
                {data?.categoriasSemTaxGroup.length ? (
                  <div className="space-y-2">
                    {data.categoriasSemTaxGroup.slice(0, 5).map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Tags className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{cat.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {cat.type === 'ENTRADA' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/settings/categories">
                            Editar <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {data.categoriasSemTaxGroup.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{data.categoriasSemTaxGroup.length - 5} categorias
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todas as categorias ativas possuem grupo tributário definido.
                  </p>
                )}
              </PendingCard>

              {/* Fator R */}
              <PendingCard
                title="Status do Fator R"
                description={`Mês de referência: ${data?.fatorRStatus?.mesReferencia || '-'}`}
                icon={TrendingDown}
                count={data?.fatorRStatus?.alertLevel !== 'ok' ? 1 : 0}
                status={data?.fatorRStatus?.alertLevel || 'ok'}
              >
                {data?.fatorRStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Fator R Atual</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          data.fatorRStatus.alertLevel === 'ok' && "text-green-600",
                          data.fatorRStatus.alertLevel === 'warning' && "text-yellow-600",
                          data.fatorRStatus.alertLevel === 'critical' && "text-destructive",
                        )}>
                          {data.fatorRStatus.fatorR.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">Folha / Receitas</p>
                        <p>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.fatorRStatus.folhaPagamento)}
                          {' / '}
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.fatorRStatus.totalReceitas)}
                        </p>
                      </div>
                    </div>
                    
                    {data.fatorRStatus.alertLevel !== 'ok' && (
                      <div className={cn(
                        "p-3 rounded-lg text-sm",
                        data.fatorRStatus.alertLevel === 'warning' && "bg-yellow-500/10 text-yellow-700",
                        data.fatorRStatus.alertLevel === 'critical' && "bg-destructive/10 text-destructive",
                      )}>
                        <p className="font-medium mb-1">
                          {data.fatorRStatus.alertLevel === 'critical' 
                            ? '⚠️ Fator R abaixo de 28%' 
                            : '⚡ Fator R próximo do limite'}
                        </p>
                        <p className="text-xs opacity-80">
                          {data.fatorRStatus.alertLevel === 'critical'
                            ? 'A empresa será tributada pelo Anexo V (alíquota maior). Considere aumentar a folha de pagamento.'
                            : 'Monitore para garantir que permaneça acima de 28%.'}
                        </p>
                      </div>
                    )}

                    <Button size="sm" variant="outline" asChild className="w-full">
                      <Link to="/reports/tax-scenarios">
                        Ver Cenários Tributários <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não há transações suficientes para calcular o Fator R.
                  </p>
                )}
              </PendingCard>

              {/* Guias Fiscais Vencidas */}
              {overdueTaxGuides.length > 0 && (
                <PendingCard
                  title="Guias Fiscais Vencidas"
                  description="DAS, DARF, GPS e outras guias em atraso"
                  icon={CalendarClock}
                  count={overdueTaxGuides.length}
                  status="critical"
                >
                  <div className="space-y-2">
                    {overdueTaxGuides.slice(0, 5).map(guia => (
                      <div key={guia.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="uppercase text-xs">
                            {guia.tipo}
                          </Badge>
                          <span className="text-sm">{guia.beneficiario || 'Sem descrição'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-destructive">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(guia.valor)}
                          </span>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to="/payables/tax-documents">
                              Ver <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {overdueTaxGuides.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{overdueTaxGuides.length - 5} guias
                      </p>
                    )}
                  </div>
                </PendingCard>
              )}

              {/* Lembrete de Extratos Bancários (só admin, dias 1-5) */}
              {showBankStatementReminder && missingStatements.hasMissing && (
                <PendingCard
                  title="Extratos Bancários Pendentes"
                  description={`Arquive os extratos de ${missingStatements.targetMonth}`}
                  icon={Landmark}
                  count={missingStatements.missingAccounts.length}
                  status="warning"
                >
                  <div className="space-y-2">
                    {missingStatements.missingAccounts.map(account => (
                      <div key={account.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{account.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Sem extrato
                        </Badge>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" asChild className="w-full mt-3">
                      <Link to="/settings/internal/fiscal-control">
                        Arquivar Extratos <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </PendingCard>
              )}
            </div>
          </TabsContent>

          {/* Aba Contratual */}
          <TabsContent value="contratual" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <PendingCard
                title="Contratos a Vencer"
                description="Contratos com vencimento nos próximos 60 dias"
                icon={FileText}
                count={expiringContracts.length}
                status={expiringContracts.length === 0 ? 'ok' : 'warning'}
              >
                {loadingContracts ? (
                  <Skeleton className="h-20 w-full" />
                ) : expiringContracts.length > 0 ? (
                  <div className="space-y-2">
                  {expiringContracts.map(contract => (
                      <div key={contract.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{contract.descricao || 'Contrato'}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {contract.data_vencimento ? format(new Date(contract.data_vencimento), 'dd/MM/yyyy') : '-'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum contrato próximo do vencimento.
                  </p>
                )}
              </PendingCard>

              {/* Placeholder para futura expansão */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">
                    Termos e Aditivos
                  </CardTitle>
                  <CardDescription>
                    Em breve: controle de termos de confidencialidade, aditivos contratuais e documentos legais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" disabled className="w-full">
                    Em desenvolvimento
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba Legal */}
          <TabsContent value="legal" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <PendingCard
                title="Processos Judiciais"
                description="Acompanhamento de processos e ações"
                icon={Gavel}
                count={0}
                status="ok"
              >
                <div className="text-center py-6">
                  <Scale className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum processo judicial cadastrado.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando houver processos, eles aparecerão aqui.
                  </p>
                </div>
              </PendingCard>

              {/* Placeholder para futura expansão */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">
                    Multas e Autuações
                  </CardTitle>
                  <CardDescription>
                    Em breve: controle de multas, autos de infração e defesas administrativas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" disabled className="w-full">
                    Em desenvolvimento
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
