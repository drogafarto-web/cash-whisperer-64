import { AppLayout } from '@/components/layout/AppLayout';
import { usePendingDetails } from '@/hooks/usePendingDetails';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Pendencias() {
  const { data, isLoading } = usePendingDetails();

  const totalPendencias = data ? (
    data.unidadesSemFechamento.length +
    data.unidadesSemTaxConfig.length +
    data.categoriasSemTaxGroup.length +
    (data.fatorRStatus?.alertLevel !== 'ok' ? 1 : 0)
  ) : 0;

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

        {/* Cards de Pendências */}
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
        </div>
      </div>
    </AppLayout>
  );
}
