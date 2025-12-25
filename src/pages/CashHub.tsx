import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Banknote, QrCode, CreditCard, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCashHubData } from '@/hooks/useCashHubData';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireFunction } from '@/components/auth/RequireFunction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface PaymentCardProps {
  title: string;
  icon: React.ElementType;
  count: number;
  primaryValue: number;
  primaryLabel: string;
  secondaryValue?: number;
  secondaryLabel?: string;
  tertiaryValue?: number;
  tertiaryLabel?: string;
  href: string;
  colorClass: string;
  iconBgClass: string;
}

function PaymentCard({
  title,
  icon: Icon,
  count,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  tertiaryValue,
  tertiaryLabel,
  href,
  colorClass,
  iconBgClass,
}: PaymentCardProps) {
  const navigate = useNavigate();
  const isResolved = count === 0;

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${isResolved ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${iconBgClass}`}>
              <Icon className={`h-6 w-6 ${colorClass}`} />
            </div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
          {isResolved ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirmado
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-base px-3 py-1">
              {count} código{count !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{primaryLabel}</span>
            <span className={`text-2xl font-bold ${colorClass}`}>
              {formatCurrency(primaryValue)}
            </span>
          </div>
          {secondaryValue !== undefined && secondaryLabel && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{secondaryLabel}</span>
              <span className="font-medium text-muted-foreground">
                {formatCurrency(secondaryValue)}
              </span>
            </div>
          )}
          {tertiaryValue !== undefined && tertiaryLabel && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{tertiaryLabel}</span>
              <span className="font-medium">
                {formatCurrency(tertiaryValue)}
              </span>
            </div>
          )}
        </div>

        <Button
          onClick={() => navigate(href)}
          className="w-full"
          variant={isResolved ? 'outline' : 'default'}
          disabled={isResolved}
        >
          {isResolved ? 'Tudo confirmado' : 'Resolver pendentes'}
          {!isResolved && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </CardContent>
    </Card>
  );
}

function CashHubContent() {
  const { activeUnit } = useAuth();
  const { data, isLoading, error } = useCashHubData();

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Central de Fechamento</h1>
          <p className="text-muted-foreground">
            {activeUnit?.name} • <span className="capitalize">{today}</span>
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-6 text-center text-destructive">
              Erro ao carregar dados. Tente novamente.
            </CardContent>
          </Card>
        )}

        {/* Cards grid */}
        {data && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Dinheiro */}
            <PaymentCard
              title="Dinheiro"
              icon={Banknote}
              count={data.cash.count}
              primaryValue={data.cash.total}
              primaryLabel="Total em caixa"
              href="/envelope-closing"
              colorClass="text-emerald-600 dark:text-emerald-400"
              iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
            />

            {/* PIX */}
            <PaymentCard
              title="PIX"
              icon={QrCode}
              count={data.pix.count}
              primaryValue={data.pix.total}
              primaryLabel="Total recebido"
              href="/pix-closing"
              colorClass="text-teal-600 dark:text-teal-400"
              iconBgClass="bg-teal-100 dark:bg-teal-900/30"
            />

            {/* Cartão */}
            <PaymentCard
              title="Cartão"
              icon={CreditCard}
              count={data.card.count}
              primaryValue={data.card.grossAmount}
              primaryLabel="Valor bruto"
              secondaryValue={data.card.feeAmount}
              secondaryLabel="(-) Taxas"
              tertiaryValue={data.card.netAmount}
              tertiaryLabel="Valor líquido"
              href="/card-closing"
              colorClass="text-violet-600 dark:text-violet-400"
              iconBgClass="bg-violet-100 dark:bg-violet-900/30"
            />
          </div>
        )}

        {/* Summary footer */}
        {data && (
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Total pendente</p>
                    <p className="text-xl font-bold">
                      {data.cash.count + data.pix.count + data.card.count} códigos
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valor total</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.cash.total + data.pix.total + data.card.netAmount)}
                    </p>
                  </div>
                </div>
                {data.cash.count === 0 && data.pix.count === 0 && data.card.count === 0 && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-base px-4 py-2">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Tudo confirmado!
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default function CashHub() {
  return (
    <RequireFunction functions={['caixa', 'supervisao']}>
      <CashHubContent />
    </RequireFunction>
  );
}
