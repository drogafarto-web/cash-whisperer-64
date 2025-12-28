import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import type { CompetenceStatus, ChecklistItem } from '@/hooks/useAccountingAudit';

interface AuditStatusCardProps {
  status: CompetenceStatus;
  checklist: ChecklistItem[];
}

const statusConfig: Record<CompetenceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
  completo: { label: 'Completo', variant: 'default', icon: <CheckCircle className="h-4 w-4" /> },
  pendente: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
  inconsistente: { label: 'Inconsistente', variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
};

const iconMap: Record<string, React.ReactNode> = {
  '✔': <CheckCircle className="h-4 w-4 text-emerald-500" />,
  '⚠': <AlertCircle className="h-4 w-4 text-amber-500" />,
  '✖': <XCircle className="h-4 w-4 text-red-500" />,
};

export function AuditStatusCard({ status, checklist }: AuditStatusCardProps) {
  const config = statusConfig[status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Status da Competência</CardTitle>
          <Badge variant={config.variant} className="flex items-center gap-1.5">
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm">
              {iconMap[item.icon]}
              <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
