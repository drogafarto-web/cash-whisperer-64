import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import type { AccountingAuditData } from '@/hooks/useAccountingAudit';

interface AuditRevenueCardProps {
  revenueComparison: AccountingAuditData['revenueComparison'];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

function getComparisonStatus(diff: number): { status: 'ok' | 'warning' | 'error'; icon: React.ReactNode } {
  const absDiff = Math.abs(diff);
  if (absDiff <= 2) return { status: 'ok', icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> };
  if (absDiff <= 5) return { status: 'warning', icon: <AlertCircle className="h-4 w-4 text-amber-500" /> };
  return { status: 'error', icon: <AlertCircle className="h-4 w-4 text-red-500" /> };
}

export function AuditRevenueCard({ revenueComparison }: AuditRevenueCardProps) {
  const nfsStatus = getComparisonStatus(revenueComparison.diferencaNfs);
  const bancoStatus = getComparisonStatus(revenueComparison.diferencaBanco);

  const rows = [
    { 
      label: 'Receita Declarada', 
      value: revenueComparison.declarada, 
      diff: null,
      status: null,
      isBase: true,
    },
    { 
      label: 'Σ Notas Fiscais', 
      value: revenueComparison.nfs, 
      diff: revenueComparison.diferencaNfs,
      status: nfsStatus,
      isBase: false,
    },
    { 
      label: 'Σ Entradas Banco', 
      value: revenueComparison.banco, 
      diff: revenueComparison.diferencaBanco,
      status: bancoStatus,
      isBase: false,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Consistência das Receitas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div 
              key={row.label} 
              className={`flex items-center justify-between p-3 rounded-lg ${
                row.isBase ? 'bg-muted/50' : 'border'
              }`}
            >
              <div className="flex items-center gap-2">
                {!row.isBase && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">{row.label}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold">
                  {formatCurrency(row.value)}
                </span>
                
                {row.diff !== null && row.status && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={row.status.status === 'ok' ? 'default' : row.status.status === 'warning' ? 'secondary' : 'destructive'}
                      className="font-mono text-xs"
                    >
                      {row.diff >= 0 ? '+' : ''}{row.diff.toFixed(1)}%
                    </Badge>
                    {row.status.icon}
                  </div>
                )}
                
                {row.isBase && (
                  <Badge variant="outline" className="text-xs">base</Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p>
            ✓ Diferenças ≤2% são aceitáveis | 
            ⚠ 2-5% requer verificação | 
            ✖ &gt;5% indica inconsistência
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
