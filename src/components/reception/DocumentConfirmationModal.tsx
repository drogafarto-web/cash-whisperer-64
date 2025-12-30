import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Wallet,
  QrCode,
  ArrowUpDown,
  BanknoteIcon,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { AnalyzedDocResult, DOCUMENT_TYPE_LABELS, isTaxDocument } from '@/services/accountingOcrService';
import { toast } from 'sonner';

export type PaymentMethodType = 'dinheiro_caixa' | 'pix' | 'transferencia' | '';

export interface OcrEditInfo {
  ocrValueEdited: boolean;
  ocrOriginalValue: number;
  ocrEditReason: string;
  editedValue: number;
}

interface DocumentConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AnalyzedDocResult;
  fileName: string;
  onConfirm: (type: 'revenue' | 'expense', extras?: { 
    description?: string; 
    paymentMethod?: PaymentMethodType; 
    needsReconciliation?: boolean;
    ocrEdit?: OcrEditInfo;
  }) => void;
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
  
  // New fields for service description and payment method
  const [serviceDescription, setServiceDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('');
  // Flag for revenue reconciliation - default to true
  const [needsReconciliation, setNeedsReconciliation] = useState(true);

  // Value editing state
  const originalValue = result.netValue || result.totalValue || 0;
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editedValue, setEditedValue] = useState<string>(originalValue.toString());
  const [editReason, setEditReason] = useState('');
  const [showEditError, setShowEditError] = useState(false);

  // Reset editing state when modal opens/closes or result changes
  useEffect(() => {
    if (open) {
      const val = result.netValue || result.totalValue || 0;
      setEditedValue(val.toString());
      setIsEditingValue(false);
      setEditReason('');
      setShowEditError(false);
    }
  }, [open, result]);

  const isRevenue = selectedType === 'revenue';
  const isExpense = selectedType === 'expense' || isTaxDoc;
  const confidencePercent = Math.round((result.confidence || 0) * 100);
  const isLowConfidence = confidencePercent < 70;
  const isUnknown = result.type === 'unknown';

  const parsedEditedValue = parseFloat(editedValue.replace(',', '.')) || 0;
  const valueWasEdited = Math.abs(parsedEditedValue - originalValue) > 0.01;

  const formatCurrency = (value: number | null) => {
    if (!value && value !== 0) return '-';
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

  const handleStartEditValue = () => {
    setIsEditingValue(true);
    setShowEditError(false);
  };

  const handleCancelEditValue = () => {
    setEditedValue(originalValue.toString());
    setIsEditingValue(false);
    setEditReason('');
    setShowEditError(false);
  };

  const handleConfirmEditValue = () => {
    if (valueWasEdited && editReason.trim().length < 10) {
      setShowEditError(true);
      return;
    }
    setIsEditingValue(false);
    setShowEditError(false);
  };

  const handleConfirm = () => {
    // Validate edit reason if value was changed
    if (valueWasEdited && editReason.trim().length < 10) {
      setShowEditError(true);
      toast.error('Informe a justificativa da correção (mínimo 10 caracteres)');
      return;
    }

    const ocrEdit: OcrEditInfo | undefined = valueWasEdited ? {
      ocrValueEdited: true,
      ocrOriginalValue: originalValue,
      ocrEditReason: editReason.trim(),
      editedValue: parsedEditedValue,
    } : undefined;

    const extras = isExpense ? {
      description: serviceDescription || undefined,
      paymentMethod: paymentMethod || undefined,
      ocrEdit,
    } : {
      needsReconciliation,
      ocrEdit,
    };
    onConfirm(selectedType, extras);
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

              {/* Value - Editable */}
              <div className="flex items-start gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-2">
                  {isEditingValue ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">R$</span>
                        <Input
                          type="text"
                          value={editedValue}
                          onChange={(e) => setEditedValue(e.target.value)}
                          className="w-32 h-8"
                          placeholder="0,00"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleConfirmEditValue}
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEditValue}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valor original OCR: {formatCurrency(originalValue)}
                      </p>
                      {valueWasEdited && (
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Justificativa da correção <span className="text-destructive">*</span>
                          </Label>
                          <Textarea
                            value={editReason}
                            onChange={(e) => {
                              setEditReason(e.target.value);
                              if (e.target.value.trim().length >= 10) {
                                setShowEditError(false);
                              }
                            }}
                            placeholder="Explique por que está corrigindo o valor (mínimo 10 caracteres)"
                            rows={2}
                            className={`resize-none text-sm ${showEditError ? 'border-destructive' : ''}`}
                          />
                          {showEditError && (
                            <p className="text-xs text-destructive">
                              Justificativa obrigatória (mínimo 10 caracteres)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className={`font-semibold ${valueWasEdited ? 'text-amber-600' : ''}`}>
                        {formatCurrency(parsedEditedValue)}
                      </span>
                      {valueWasEdited && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                          Corrigido
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEditValue}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Editar valor"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {valueWasEdited && !isEditingValue && editReason && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Motivo:</span> {editReason}
                    </p>
                  )}
                </div>
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

          {/* Service Description and Payment Method - only for expenses */}
          {isExpense && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium text-muted-foreground">Informações Adicionais</h4>
              
              {/* Service Description */}
              <div className="space-y-2">
                <Label htmlFor="service-description">Descrição do Serviço</Label>
                <Textarea
                  id="service-description"
                  placeholder="Descreva a necessidade do serviço (ex: manutenção do ar-condicionado, compra de material de escritório...)"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Como será pago?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro_caixa">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        Dinheiro do Caixa
                      </span>
                    </SelectItem>
                    <SelectItem value="pix">
                      <span className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-primary" />
                        PIX
                      </span>
                    </SelectItem>
                    <SelectItem value="transferencia">
                      <span className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-blue-600" />
                        Transferência de Conta
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Reconciliation flag - only for revenues */}
          {isRevenue && !isTaxDoc && (
            <div className="border-t pt-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <Checkbox
                  id="needs-reconciliation"
                  checked={needsReconciliation}
                  onCheckedChange={(checked) => setNeedsReconciliation(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="needs-reconciliation" 
                    className="text-sm font-medium text-emerald-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <BanknoteIcon className="h-4 w-4" />
                      Conciliar com extrato bancário
                    </div>
                  </Label>
                  <p className="text-xs text-emerald-600 mt-1">
                    Esta NF-e será vinculada a um lançamento de entrada no extrato bancário
                  </p>
                </div>
              </div>
            </div>
          )}
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
