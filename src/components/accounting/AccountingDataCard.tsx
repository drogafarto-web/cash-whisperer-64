import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calculator,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface AccountingDataCardProps {
  type: 'impostos' | 'receita' | 'folha' | 'fator-r';
  data: {
    impostos?: {
      das: number;
      iss_proprio: number;
      iss_retido: number;
      irrf_retido: number;
      outros: number;
      total: number;
    };
    receita?: {
      servicos: number;
      outras: number;
      total: number;
    };
    folha?: {
      salarios: number;
      prolabore: number;
      inss_patronal: number;
      fgts: number;
      decimo_terceiro: number;
      ferias: number;
      total: number;
    };
    fatorR?: {
      percentual: number;
      anexo: 'III' | 'V';
      status: 'ok' | 'alerta' | 'critico';
    };
  };
  competence: Date;
}

export function AccountingDataCard({ type, data, competence }: AccountingDataCardProps) {
  const navigate = useNavigate();
  const monthParam = format(competence, 'yyyy-MM');

  if (type === 'impostos' && data.impostos) {
    const { das, iss_proprio, iss_retido, irrf_retido, outros, total } = data.impostos;
    const hasData = total > 0;

    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
        onClick={() => navigate(`/reports/tax-scenarios?month=${monthParam}`)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <TrendingUp className="h-4 w-4" />
              </div>
              Impostos do Mês
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                <span>DAS: {formatCurrency(das)}</span>
                <span>ISS: {formatCurrency(iss_proprio + iss_retido)}</span>
                <span>IRRF: {formatCurrency(irrf_retido)}</span>
                {outros > 0 && <span>Outros: {formatCurrency(outros)}</span>}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando dados</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (type === 'receita' && data.receita) {
    const { servicos, outras, total } = data.receita;
    const hasData = total > 0;

    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
        onClick={() => navigate(`/billing/summary?month=${monthParam}`)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <DollarSign className="h-4 w-4" />
              </div>
              Receita do Mês
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <div className="text-sm text-muted-foreground">
                <p>Serviços: {formatCurrency(servicos)}</p>
                {outras > 0 && <p>Outras: {formatCurrency(outras)}</p>}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando dados</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (type === 'folha' && data.folha) {
    const { salarios, prolabore, total } = data.folha;
    const hasData = total > 0;

    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
        onClick={() => navigate('/settings/fiscal-base')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="h-4 w-4" />
              </div>
              Folha de Pagamento
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <div className="text-sm text-muted-foreground">
                <p>Salários: {formatCurrency(salarios)}</p>
                <p>Pró-labore: {formatCurrency(prolabore)}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando dados</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (type === 'fator-r' && data.fatorR) {
    const { percentual, anexo, status } = data.fatorR;
    const hasData = percentual > 0;

    const statusConfig = {
      ok: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Ótimo' },
      alerta: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Atenção' },
      critico: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Crítico' },
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
        onClick={() => navigate('/settings/fator-r-audit')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Calculator className="h-4 w-4" />
              </div>
              Fator R
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold">{percentual.toFixed(1)}%</p>
                <Badge variant={status === 'ok' ? 'secondary' : status === 'alerta' ? 'outline' : 'destructive'}>
                  Anexo {anexo}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Limite: 28%</span>
                  <span className={config.color}>
                    <StatusIcon className="h-4 w-4 inline mr-1" />
                    {config.label}
                  </span>
                </div>
                <Progress 
                  value={Math.min(percentual / 35 * 100, 100)} 
                  className="h-2"
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando dados</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
