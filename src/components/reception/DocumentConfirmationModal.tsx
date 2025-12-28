import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Receipt, 
  AlertTriangle,
  CheckCircle2,
  Building2,
  Calendar,
  DollarSign,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import { AnalyzedDocResult } from '@/services/accountingOcrService';

interface DocumentConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AnalyzedDocResult;
  fileName: string;
  onConfirm: (type: 'revenue' | 'expense') => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function DocumentConfirmationModal({
  open,
  onOpenChange,
  result,
  fileName,
  onConfirm,
  onCancel,
  isConfirming = false,
}: DocumentConfirmationModalProps) {
  // Allow user to change classification
  const [selectedType, setSelectedType] = useState<'revenue' | 'expense'>(
    result.type === 'unknown' ? 'expense' : result.type
  );

  const isRevenue = selectedType === 'revenue';
  const confidencePercent = Math.round((result.confidence || 0) * 100);
  const isLowConfidence = confidencePercent < 70;
  const isUnknown = result.type === 'unknown';

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('pt-BR');
    } catch {
      return date;
    }
  };

  const handleToggleType = () => {
    setSelectedType(prev => prev === 'revenue' ? 'expense' : 'revenue');
  };

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRevenue ? (
              <FileText className="h-5 w-5 text-emerald-600" />
            ) : (
              <Receipt className="h-5 w-5 text-amber-600" />
            )}
            Confirmar Classificação
          </DialogTitle>
          <DialogDescription>
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Classification Badge */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <Badge 
                variant={isRevenue ? 'default' : 'secondary'}
                className={`text-base px-3 py-1 ${
                  isRevenue 
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {isRevenue ? '📥 RECEITA' : '📤 DESPESA'}
              </Badge>
              
              {!isUnknown && (
                <Badge 
                  variant="outline" 
                  className={isLowConfidence ? 'border-amber-500 text-amber-600' : ''}
                >
                  {confidencePercent}% confiança
                </Badge>
              )}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToggleType}
              className="gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {isRevenue ? 'É Despesa' : 'É Receita'}
            </Button>
          </div>

          {/* Classification reason */}
          {(isUnknown || isLowConfidence) && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">
                  {isUnknown ? 'Classificação manual necessária' : 'Confiança baixa'}
                </p>
                <p className="text-amber-700 mt-1">
                  {result.classificationReason || 'Não foi possível identificar automaticamente o tipo de documento.'}
                </p>
              </div>
            </div>
          )}

          {!isUnknown && !isLowConfidence && result.classificationReason && (
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {result.classificationReason}
              </p>
            </div>
          )}

          {/* Extracted data */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Dados Extraídos</h4>
            
            <div className="grid gap-2">
              {/* Issuer */}
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isRevenue ? 'Cliente:' : 'Fornecedor:'}
                </span>
                <span className="font-medium">
                  {isRevenue 
                    ? result.customerName || 'Não identificado' 
                    : result.issuerName || 'Não identificado'
                  }
                </span>
              </div>

              {/* CNPJ */}
              {(result.issuerCnpj || result.customerCnpj) && (
                <div className="flex items-center gap-2 text-sm pl-6">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-mono text-xs">
                    {isRevenue ? result.customerCnpj : result.issuerCnpj}
                  </span>
                </div>
              )}

              {/* Value */}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-semibold">
                  {formatCurrency(result.netValue || result.totalValue)}
                </span>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isRevenue ? 'Emissão:' : 'Vencimento:'}
                </span>
                <span>
                  {isRevenue 
                    ? formatDate(result.issueDate) 
                    : formatDate(result.dueDate || result.issueDate)
                  }
                </span>
              </div>

              {/* Document number */}
              {result.documentNumber && (
                <div className="flex items-center gap-2 text-sm pl-6">
                  <span className="text-muted-foreground">Nº Doc:</span>
                  <span className="font-mono text-xs">{result.documentNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isConfirming}
            className={isRevenue ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar como {isRevenue ? 'Receita' : 'Despesa'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
