import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, ExternalLink, Calendar, DollarSign, Building } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExistingPayableData {
  id: string;
  beneficiario: string | null;
  valor: number | null;
  vencimento: string | null;
  status: string | null;
  created_at: string | null;
}

interface TaxDuplicateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  matchType: 'codigo_barras' | 'linha_digitavel' | 'cnpj_document' | 'cnpj_valor_vencimento' | string;
  existingData: ExistingPayableData | null;
  onCancel: () => void;
  onForceContinue: () => void;
  isLoading?: boolean;
}

const MATCH_TYPE_LABELS: Record<string, { label: string; severity: 'high' | 'medium' }> = {
  codigo_barras: { label: 'Código de Barras', severity: 'high' },
  linha_digitavel: { label: 'Linha Digitável', severity: 'high' },
  cnpj_document: { label: 'CNPJ + Número do Documento', severity: 'medium' },
  cnpj_valor_vencimento: { label: 'CNPJ + Valor + Vencimento', severity: 'medium' },
};

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
  VENCIDO: 'Vencido',
};

export function TaxDuplicateModal({
  open,
  onOpenChange,
  documentName,
  matchType,
  existingData,
  onCancel,
  onForceContinue,
  isLoading = false,
}: TaxDuplicateModalProps) {
  const matchInfo = MATCH_TYPE_LABELS[matchType] || { label: matchType, severity: 'medium' };
  const isHighSeverity = matchInfo.severity === 'high';

  const formatCurrency = (value: number | null) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Documento Duplicado Detectado
          </DialogTitle>
          <DialogDescription>
            Este documento já existe no sistema. Verifique antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current document */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{documentName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Documento que você está tentando cadastrar
              </p>
            </div>
          </div>

          {/* Match type */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <span className="text-sm font-medium">Critério de duplicidade:</span>
            <Badge 
              variant={isHighSeverity ? 'destructive' : 'secondary'}
              className={isHighSeverity ? '' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'}
            >
              {matchInfo.label}
            </Badge>
          </div>

          {/* Existing document details */}
          {existingData && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Documento existente no sistema:
              </p>
              
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{existingData.beneficiario || 'Beneficiário não identificado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{formatCurrency(existingData.valor)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>Venc: {formatDate(existingData.vencimento)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge variant="outline">
                    {STATUS_LABELS[existingData.status || ''] || existingData.status || 'Desconhecido'}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 text-xs"
                    asChild
                  >
                    <a 
                      href={`/payables/boletos?highlight=${existingData.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver documento <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Warning for high severity */}
          {isHighSeverity && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Duplicidade por {matchInfo.label.toLowerCase()} é altamente confiável. 
                Este documento provavelmente já foi cadastrado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant={isHighSeverity ? 'destructive' : 'default'}
            onClick={onForceContinue}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Processando...' : 'Cadastrar Mesmo Assim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
