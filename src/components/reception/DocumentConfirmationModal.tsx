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
  Copy,
  Landmark,
} from 'lucide-react';
import { AnalyzedDocResult, DOCUMENT_TYPE_LABELS, isTaxDocument } from '@/services/accountingOcrService';
import { toast } from 'sonner';

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
  // Allow user to change classification (mas não para guias tributárias)
  const isTaxDoc = isTaxDocument(result.documentType);
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
    if (!isTaxDoc) {
      setSelectedType(prev => prev === 'revenue' ? 'expense' : 'revenue');
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  const handleCopy = (text: string | null, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const docTypeLabel = DOCUMENT_TYPE_LABELS[result.documentType] || result.documentType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTaxDoc ? (
              <Landmark className="h-5 w-5 text-blue-600" />
            ) : isRevenue ? (
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
          {/* Document Type Badge */}
          {isTaxDoc && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Landmark className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">{docTypeLabel}</p>
                <p className="text-sm text-blue-600">Guia tributária - classificada automaticamente como despesa</p>
              </div>
            </div>
          )}

          {/* Classification Badge */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <Badge 
                variant={isRevenue ? 'default' : 'secondary'}
                className={`text-base px-3 py-1 ${
                  isTaxDoc
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                    : isRevenue 
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {isTaxDoc ? `🏛️ ${docTypeLabel}` : isRevenue ? '📥 RECEITA' : '📤 DESPESA'}
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

            {!isTaxDoc && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToggleType}
                className="gap-2"
              >
                <ArrowRightLeft className="h-4 w-4" />
                {isRevenue ? 'É Despesa' : 'É Receita'}
              </Button>
            )}
          </div>

          {/* Classification reason */}
          {(isUnknown || isLowConfidence) && !isTaxDoc && (
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

          {/* Payment Info for Tax Documents */}
          {(result.codigoBarras || result.linhaDigitavel || result.pixKey) && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Dados para Pagamento
              </h4>
              
              {result.linhaDigitavel && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Linha Digitável</span>
                    <p className="text-xs font-mono truncate">{result.linhaDigitavel}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(result.linhaDigitavel, 'Linha digitável')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {result.codigoBarras && !result.linhaDigitavel && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Código de Barras</span>
                    <p className="text-xs font-mono truncate">{result.codigoBarras}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(result.codigoBarras, 'Código de barras')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {result.pixKey && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">
                      Chave PIX ({result.pixTipo || 'desconhecido'})
                    </span>
                    <p className="text-xs font-mono truncate">{result.pixKey}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(result.pixKey, 'Chave PIX')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
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
                  {isTaxDoc ? 'Contribuinte:' : isRevenue ? 'Cliente:' : 'Fornecedor:'}
                </span>
                <span className="font-medium">
                  {isTaxDoc
                    ? result.issuerName || 'Não identificado'
                    : isRevenue 
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
                    {isTaxDoc ? result.issuerCnpj : isRevenue ? result.customerCnpj : result.issuerCnpj}
                  </span>
                </div>
              )}

              {/* Competence for tax documents */}
              {isTaxDoc && result.competenceYear && result.competenceMonth && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Competência:</span>
                  <span className="font-medium">
                    {String(result.competenceMonth).padStart(2, '0')}/{result.competenceYear}
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
            className={
              isTaxDoc 
                ? 'bg-blue-600 hover:bg-blue-700'
                : isRevenue 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : 'bg-amber-600 hover:bg-amber-700'
            }
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar como {isTaxDoc ? docTypeLabel : isRevenue ? 'Receita' : 'Despesa'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
