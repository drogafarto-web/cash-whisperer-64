import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Clock, 
  Calendar,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { useCompetenceDocuments } from '@/hooks/useAccountingCompetence';
import { differenceInDays, format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TaxDueDateAlertProps {
  unitId: string;
  ano: number;
  mes: number;
  compact?: boolean;
}

interface DueDateItem {
  id: string;
  fileName: string;
  category: string;
  dueDate: Date;
  valor: number | null;
  daysRemaining: number;
  status: 'overdue' | 'urgent' | 'warning' | 'ok';
}

const STATUS_CONFIG = {
  overdue: { 
    label: 'Vencido', 
    className: 'bg-destructive text-destructive-foreground',
    alertClass: 'border-destructive/50 bg-destructive/10',
  },
  urgent: { 
    label: 'Urgente', 
    className: 'bg-orange-500 text-white',
    alertClass: 'border-orange-500/50 bg-orange-500/10',
  },
  warning: { 
    label: 'Próximo', 
    className: 'bg-yellow-500 text-black',
    alertClass: 'border-yellow-500/50 bg-yellow-500/10',
  },
  ok: { 
    label: 'OK', 
    className: 'bg-green-500 text-white',
    alertClass: '',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  das: 'DAS',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  iss: 'ISS',
};

export function getDueDateStatus(dueDate: Date): { status: 'overdue' | 'urgent' | 'warning' | 'ok'; daysRemaining: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = differenceInDays(dueDate, today);

  if (daysRemaining < 0) return { status: 'overdue', daysRemaining };
  if (daysRemaining <= 3) return { status: 'urgent', daysRemaining };
  if (daysRemaining <= 7) return { status: 'warning', daysRemaining };
  return { status: 'ok', daysRemaining };
}

export function TaxDueDateAlert({ unitId, ano, mes, compact = false }: TaxDueDateAlertProps) {
  const { data: documents, isLoading } = useCompetenceDocuments(unitId, ano, mes);

  const alerts = useMemo(() => {
    if (!documents?.length) return [];

    const items: DueDateItem[] = [];

    documents.forEach(doc => {
      if (doc.ocr_status !== 'processado') return;
      
      const ocrData = doc.ocr_data as Record<string, unknown> | null;
      const vencimento = ocrData?.vencimento as string | null;
      const valor = ocrData?.valor as number | null;

      if (!vencimento) return;

      try {
        const dueDate = parseISO(vencimento);
        if (!isValid(dueDate)) return;

        const { status, daysRemaining } = getDueDateStatus(dueDate);
        
        // Only include items that need attention (not 'ok')
        if (status !== 'ok') {
          items.push({
            id: doc.id,
            fileName: doc.file_name,
            category: doc.categoria,
            dueDate,
            valor,
            daysRemaining,
            status,
          });
        }
      } catch {
        // Invalid date format
      }
    });

    // Sort by urgency (overdue first, then by days remaining)
    return items.sort((a, b) => {
      const statusOrder = { overdue: 0, urgent: 1, warning: 2, ok: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.daysRemaining - b.daysRemaining;
    });
  }, [documents]);

  if (isLoading || alerts.length === 0) {
    return null;
  }

  const overdueCount = alerts.filter(a => a.status === 'overdue').length;
  const urgentCount = alerts.filter(a => a.status === 'urgent').length;

  // Compact mode - just show a badge/alert
  if (compact) {
    return (
      <Alert className={cn(
        "border",
        overdueCount > 0 ? STATUS_CONFIG.overdue.alertClass : STATUS_CONFIG.urgent.alertClass
      )}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Atenção aos Vencimentos
          {overdueCount > 0 && (
            <Badge className={STATUS_CONFIG.overdue.className}>{overdueCount} vencido(s)</Badge>
          )}
          {urgentCount > 0 && (
            <Badge className={STATUS_CONFIG.urgent.className}>{urgentCount} urgente(s)</Badge>
          )}
        </AlertTitle>
        <AlertDescription>
          {alerts.length} documento(s) precisam de atenção
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-orange-500" />
          Alertas de Vencimento
          <div className="flex gap-1 ml-auto">
            {overdueCount > 0 && (
              <Badge className={STATUS_CONFIG.overdue.className}>{overdueCount}</Badge>
            )}
            {urgentCount > 0 && (
              <Badge className={STATUS_CONFIG.urgent.className}>{urgentCount}</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.slice(0, 5).map((item) => (
          <div 
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              item.status === 'overdue' && "border-destructive/50 bg-destructive/5",
              item.status === 'urgent' && "border-orange-500/50 bg-orange-500/5",
              item.status === 'warning' && "border-yellow-500/50 bg-yellow-500/5",
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-medium">
                  {CATEGORY_LABELS[item.category] || item.category.toUpperCase()}
                </Badge>
                <Badge className={STATUS_CONFIG[item.status].className}>
                  {item.status === 'overdue' 
                    ? `Vencido há ${Math.abs(item.daysRemaining)} dia(s)`
                    : `${item.daysRemaining} dia(s)`
                  }
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(item.dueDate, "dd/MM/yyyy")}
                </span>
                {item.valor && (
                  <span className="font-medium">
                    R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
        
        {alerts.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            + {alerts.length - 5} outro(s) alerta(s)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for inline badge in file upload
export function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;

  try {
    const date = parseISO(dueDate);
    if (!isValid(date)) return null;

    const { status, daysRemaining } = getDueDateStatus(date);
    
    if (status === 'ok') return null;

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1 text-xs",
          status === 'overdue' && "border-destructive text-destructive",
          status === 'urgent' && "border-orange-500 text-orange-600",
          status === 'warning' && "border-yellow-500 text-yellow-600",
        )}
      >
        <Clock className="h-3 w-3" />
        {status === 'overdue' 
          ? `Vencido há ${Math.abs(daysRemaining)}d`
          : `${daysRemaining}d`
        }
      </Badge>
    );
  } catch {
    return null;
  }
}
