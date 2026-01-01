import { Clock, ChevronRight, FileText, Receipt, Wallet, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface ActivityItem {
  id: string;
  tipo: string | null;
  beneficiario: string | null;
  description: string | null;
  valor: number | null;
  status: string | null;
  created_at: string;
}

interface TodayActivityCardProps {
  items: ActivityItem[];
  total: number;
  count: number;
  isLoading: boolean;
  onViewAll?: () => void;
  title?: string;
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  boleto: Wallet,
  nf_fornecedor: FileSpreadsheet,
  recibo: Receipt,
  das: FileText,
  darf: FileText,
  gps: FileText,
  inss: FileText,
  fgts: FileText,
  iss: FileText,
};

const TIPO_LABELS: Record<string, string> = {
  boleto: 'Boleto',
  nf_fornecedor: 'NF',
  recibo: 'Recibo',
  das: 'DAS',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  iss: 'ISS',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', variant: 'outline', icon: AlertCircle },
  processando: { label: 'Processando', variant: 'secondary', icon: Loader2 },
  pago: { label: 'Pago', variant: 'default', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', variant: 'outline', icon: AlertCircle },
};

export function TodayActivityCard({ 
  items, 
  total, 
  count, 
  isLoading, 
  onViewAll,
  title = "Lançamentos de Hoje" 
}: TodayActivityCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {title}
            {count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
          </CardTitle>
          {onViewAll && count > 0 && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs gap-1">
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum lançamento hoje ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = TIPO_ICONS[item.tipo || ''] || FileText;
              const tipoLabel = TIPO_LABELS[item.tipo || ''] || item.tipo || 'Doc';
              const statusConfig = STATUS_CONFIG[item.status || 'pendente'] || STATUS_CONFIG.pendente;
              const time = format(new Date(item.created_at), 'HH:mm');
              
              return (
                <div 
                  key={item.id} 
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {/* Hora */}
                  <span className="text-xs text-muted-foreground font-mono w-10 flex-shrink-0">
                    {time}
                  </span>
                  
                  {/* Ícone e Tipo */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs font-normal">
                      {tipoLabel}
                    </Badge>
                  </div>
                  
                  {/* Descrição */}
                  <span className="text-sm truncate flex-1 text-foreground">
                    {item.beneficiario || item.description || 'Sem descrição'}
                  </span>
                  
                  {/* Valor */}
                  <span className="text-sm font-medium text-foreground flex-shrink-0">
                    {formatCurrency(item.valor || 0)}
                  </span>
                  
                  {/* Status */}
                  <Badge variant={statusConfig.variant} className="text-xs gap-1 flex-shrink-0">
                    <statusConfig.icon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
              );
            })}
            
            {/* Total */}
            {items.length > 0 && (
              <div className="flex items-center justify-between pt-2 mt-2 border-t text-sm">
                <span className="text-muted-foreground">Total do dia</span>
                <span className="font-semibold">{formatCurrency(total)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
