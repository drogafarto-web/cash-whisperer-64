import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, ExternalLink, CreditCard, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnalyzedDocResult } from '@/services/accountingOcrService';
import { DuplicateCheckResult } from '@/types/duplicateCheck';
import { DuplicateAlert } from './DuplicateAlert';

interface AccountingOcrResultCardProps {
  result: AnalyzedDocResult;
  fileName: string;
  recordCreated: boolean;
  recordType?: 'invoice' | 'payable';
  recordId?: string;
  isDuplicate?: boolean;
  duplicateId?: string;
  duplicateCheck?: DuplicateCheckResult;
  onViewRecord?: (type: 'invoice' | 'payable', id: string) => void;
  onAddPaymentData?: (payableId: string) => void;
  onConfirmDuplicate?: () => void;
}

export function AccountingOcrResultCard({
  result,
  fileName,
  recordCreated,
  recordType,
  recordId,
  isDuplicate,
  duplicateId,
  duplicateCheck,
  onViewRecord,
  onAddPaymentData,
  onConfirmDuplicate,
}: AccountingOcrResultCardProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch {
      return date;
    }
  };

  const getTypeConfig = () => {
    switch (result.type) {
      case 'revenue':
        return {
          icon: TrendingUp,
          label: 'RECEITA',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-600',
          badgeVariant: 'default' as const,
        };
      case 'expense':
        return {
          icon: TrendingDown,
          label: 'DESPESA',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-600',
          badgeVariant: 'destructive' as const,
        };
      default:
        return {
          icon: AlertTriangle,
          label: 'REVISÃO MANUAL',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-600',
          badgeVariant: 'secondary' as const,
        };
    }
  };

  const getDocumentTypeLabel = () => {
    const labels: Record<string, string> = {
      nfse: 'NFS-e',
      nf_produto: 'NF Produto',
      boleto: 'Boleto',
      recibo: 'Recibo',
      extrato: 'Extrato',
      outro: 'Documento',
    };
    return labels[result.documentType] || 'Documento';
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  return (
    <Card className={cn('border-2 transition-all', config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon and classification */}
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-full', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.textColor)} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={config.badgeVariant} className="font-semibold">
                  {config.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getDocumentTypeLabel()}
                </Badge>
                {result.documentNumber && (
                  <span className="text-sm text-muted-foreground">
                    nº {result.documentNumber}
                  </span>
                )}
              </div>
              
              {/* Classification reason */}
              <p className="text-sm text-muted-foreground">
                {result.classificationReason}
              </p>

              {/* Details */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-2">
                {result.issuerName && (
                  <span>
                    <span className="text-muted-foreground">Emissor:</span>{' '}
                    <span className="font-medium">{result.issuerName}</span>
                  </span>
                )}
                {result.customerName && (
                  <span>
                    <span className="text-muted-foreground">Tomador:</span>{' '}
                    <span className="font-medium">{result.customerName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Value and status */}
          <div className="text-right space-y-2 shrink-0">
            <p className={cn('text-lg font-bold', config.textColor)}>
              {formatCurrency(result.netValue || result.totalValue)}
            </p>
            
            {result.issueDate && (
              <p className="text-xs text-muted-foreground">
                Emissão: {formatDate(result.issueDate)}
              </p>
            )}

            {/* Confidence */}
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-muted-foreground">
                Confiança: {Math.round(result.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Alerta de duplicidade multi-nível */}
        {duplicateCheck && duplicateCheck.level !== 'none' && (
          <div className="mt-4">
            <DuplicateAlert
              duplicateCheck={duplicateCheck}
              onViewExisting={(id) => onViewRecord?.(recordType || 'payable', id)}
              onConfirmContinue={onConfirmDuplicate}
            />
          </div>
        )}

        {/* Sugestão do Assistente IA */}
        {result.attendantSuggestion && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-primary mb-1">Sugestão do Assistente IA</p>
                <p className="text-sm text-foreground/80">{result.attendantSuggestion}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {isDuplicate ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-600 font-medium">
                  Documento já cadastrado
                </span>
              </>
            ) : recordCreated ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 font-medium">
                  {recordType === 'invoice' ? 'Cadastrado em Faturamento' : 'Cadastrado em Despesas'}
                </span>
              </>
            ) : result.type === 'unknown' ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-600 font-medium">
                  Aguardando classificação manual
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">
                  Erro ao cadastrar
                </span>
              </>
            )}
          </div>

          {/* View record button */}
          {(recordCreated || isDuplicate) && recordType && (recordId || duplicateId) && onViewRecord && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewRecord(recordType, (recordId || duplicateId)!)}
              className="gap-1 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              Ver registro
            </Button>
          )}

          {/* Add payment data button - only for payables that were just created */}
          {recordCreated && recordType === 'payable' && recordId && onAddPaymentData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddPaymentData(recordId)}
              className="gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              <CreditCard className="h-3 w-3" />
              Adicionar Boleto/PIX
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
