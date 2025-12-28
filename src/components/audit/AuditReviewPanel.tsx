import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CheckCircle, AlertCircle, MessageSquare, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditLog, AuditCategory, AuditStatus } from '@/hooks/useAccountingAudit';
import { useAuditLogMutation } from '@/hooks/useAccountingAudit';
import { toast } from 'sonner';

interface AuditReviewPanelProps {
  unitId: string | null;
  ano: number;
  mes: number;
  auditLogs: AuditLog[];
}

const categoryLabels: Record<AuditCategory, string> = {
  folha: 'Folha',
  das: 'DAS',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  iss: 'ISS',
  receitas: 'Receitas',
  geral: 'Geral',
};

const statusConfig: Record<AuditStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' }> = {
  revisado: { label: 'Revisado/OK', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  pendencia: { label: 'Com Pendência', icon: <AlertCircle className="h-3 w-3" />, variant: 'destructive' },
  pendente: { label: 'Pendente', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
};

export function AuditReviewPanel({ unitId, ano, mes, auditLogs }: AuditReviewPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('geral');
  const [selectedStatus, setSelectedStatus] = useState<AuditStatus>('revisado');
  const [comentario, setComentario] = useState('');
  
  const mutation = useAuditLogMutation();

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        unitId,
        ano,
        mes,
        categoria: selectedCategory,
        status: selectedStatus,
        comentario: comentario || undefined,
      });
      
      toast.success('Revisão registrada com sucesso');
      setComentario('');
    } catch (error) {
      toast.error('Erro ao registrar revisão');
    }
  };

  // Get existing log for selected category
  const existingLog = auditLogs.find(log => log.categoria === selectedCategory);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Revisão & Comentários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as AuditCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as AuditStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revisado">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Revisado/OK
                  </div>
                </SelectItem>
                <SelectItem value="pendencia">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Com Pendência
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {existingLog && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="text-muted-foreground">
              Status atual de <strong>{categoryLabels[selectedCategory]}</strong>: 
              <Badge variant={statusConfig[existingLog.status as AuditStatus]?.variant || 'secondary'} className="ml-2">
                {statusConfig[existingLog.status as AuditStatus]?.label || existingLog.status}
              </Badge>
            </p>
            {existingLog.comentario && (
              <p className="mt-1 text-muted-foreground italic">"{existingLog.comentario}"</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Comentário (opcional)</label>
          <Textarea 
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Adicione um comentário sobre esta revisão..."
            rows={2}
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? 'Salvando...' : 'Registrar Revisão'}
        </Button>

        {/* Histórico */}
        {auditLogs.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Histórico de revisões</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {auditLogs.map((log) => {
                const config = statusConfig[log.status as AuditStatus];
                return (
                  <div key={log.id} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                    {config?.icon || <Clock className="h-3 w-3 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{categoryLabels[log.categoria as AuditCategory]}</span>
                        <Badge variant={config?.variant || 'secondary'} className="text-xs">
                          {config?.label || log.status}
                        </Badge>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {log.comentario && (
                        <p className="text-muted-foreground text-xs mt-1 truncate">{log.comentario}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
