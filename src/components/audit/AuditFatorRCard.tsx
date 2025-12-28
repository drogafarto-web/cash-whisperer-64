import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { AccountingAuditData } from '@/hooks/useAccountingAudit';

interface AuditFatorRCardProps {
  competenceData: AccountingAuditData['competenceData'];
  fatorR: AccountingAuditData['fatorR'];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function AuditFatorRCard({ competenceData, fatorR }: AuditFatorRCardProps) {
  const statusConfig = {
    ok: { color: 'text-emerald-600', bg: 'bg-emerald-500', icon: <TrendingUp className="h-4 w-4" /> },
    alerta: { color: 'text-amber-600', bg: 'bg-amber-500', icon: <AlertTriangle className="h-4 w-4" /> },
    critico: { color: 'text-red-600', bg: 'bg-red-500', icon: <TrendingDown className="h-4 w-4" /> },
  };

  const config = statusConfig[fatorR.status];
  const progressValue = Math.min(fatorR.acumulado12m, 50);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Folha × Fator R</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dados da Folha */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Folha</p>
            <p className="font-semibold">{formatCurrency(competenceData?.total_folha || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Encargos</p>
            <p className="font-semibold">{formatCurrency(competenceData?.encargos || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pró-labore</p>
            <p className="font-semibold">{formatCurrency(competenceData?.prolabore || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Funcionários</p>
            <p className="font-semibold">{competenceData?.num_funcionarios || 0}</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Receita Serviços</p>
              <p className="font-semibold">{formatCurrency(competenceData?.receita_servicos || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Outras Receitas</p>
              <p className="font-semibold">{formatCurrency(competenceData?.receita_outras || 0)}</p>
            </div>
          </div>
        </div>

        {/* Fator R */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Fator R Mensal</p>
              <p className={`text-xl font-bold ${config.color}`}>{fatorR.mensal.toFixed(1)}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Fator R 12 meses</p>
              <p className={`text-xl font-bold ${config.color}`}>{fatorR.acumulado12m.toFixed(1)}%</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Anexo V</span>
              <span>28%</span>
              <span>Anexo III</span>
            </div>
            <div className="relative">
              <Progress value={progressValue * 2} className="h-2" />
              <div className="absolute top-0 left-[56%] w-0.5 h-2 bg-border" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant={fatorR.anexo === 'III' ? 'default' : 'destructive'}>
              Anexo {fatorR.anexo}
            </Badge>
            <div className={`flex items-center gap-1 text-sm ${config.color}`}>
              {config.icon}
              <span>Margem: {fatorR.margem >= 0 ? '+' : ''}{fatorR.margem.toFixed(1)}pp</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
