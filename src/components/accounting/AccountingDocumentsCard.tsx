import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { AccountingDocument } from '@/hooks/useAccountingDashboard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccountingDocumentsCardProps {
  documents: AccountingDocument[];
  onSendLink: () => void;
  onViewAll: () => void;
  linkStatus: {
    enviado: boolean;
    enviadoEm: string | null;
    usado: boolean;
    expirado: boolean;
  };
}

const TIPO_LABELS: Record<string, string> = {
  das: 'DAS',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  folha: 'Folha',
  nf_servico: 'NF Serviço',
  outro: 'Outro',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  enviado: { icon: Clock, color: 'text-amber-500', label: 'Enviado' },
  conferido: { icon: Eye, color: 'text-blue-500', label: 'Conferido' },
  vinculado: { icon: Link2, color: 'text-emerald-500', label: 'Vinculado' },
  pago: { icon: CheckCircle, color: 'text-green-500', label: 'Pago' },
};

export function AccountingDocumentsCard({ 
  documents, 
  onSendLink, 
  onViewAll,
  linkStatus 
}: AccountingDocumentsCardProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getLinkStatusBadge = () => {
    if (!linkStatus.enviado) return null;
    if (linkStatus.expirado) return <Badge variant="destructive">Expirado</Badge>;
    if (linkStatus.usado) return <Badge variant="secondary">Usado</Badge>;
    return <Badge variant="outline" className="text-emerald-600 border-emerald-300">Ativo</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Documentos da Contabilidade
          {documents.length > 0 && (
            <Badge variant="secondary">{documents.length}</Badge>
          )}
        </CardTitle>
        {getLinkStatusBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Link status */}
        {linkStatus.enviado && linkStatus.enviadoEm && (
          <p className="text-sm text-muted-foreground">
            Link enviado {formatDistanceToNow(new Date(linkStatus.enviadoEm), { locale: ptBR, addSuffix: true })}
          </p>
        )}

        {/* Documents list */}
        {documents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum documento recebido ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => {
              const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.enviado;
              const StatusIcon = statusConfig.icon;
              
              return (
                <div 
                  key={doc.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {TIPO_LABELS[doc.tipo_documento] || doc.tipo_documento}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(doc.valor_documento)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusConfig.label}
                    </p>
                  </div>
                </div>
              );
            })}

            {documents.length > 5 && (
              <p className="text-xs text-center text-muted-foreground">
                +{documents.length - 5} documento(s)
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onSendLink}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {linkStatus.enviado ? 'Novo Link' : 'Enviar Link'}
          </Button>
          {documents.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onViewAll}
            >
              Ver todos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
