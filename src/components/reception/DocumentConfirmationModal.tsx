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
  X,
  Hash,
} from 'lucide-react';
import { AnalyzedDocResult, DOCUMENT_TYPE_LABELS, isTaxDocument } from '@/services/accountingOcrService';
import { toast } from 'sonner';

export type PaymentMethodType = 'dinheiro_caixa' | 'pix' | 'transferencia' | '';

export interface EditedFieldInfo {
  original: string | number | null;
  edited: string | number;
}

export interface OcrEditInfo {
  ocrValueEdited: boolean;
  ocrOriginalValue: number;
  ocrEditReason: string;
  editedValue: number;
  // Expanded fields
  fieldsEdited?: {
    valor?: EditedFieldInfo;
    vencimento?: EditedFieldInfo;
    linhaDigitavel?: EditedFieldInfo;
    codigoBarras?: EditedFieldInfo;
    fornecedor?: EditedFieldInfo;
    cnpj?: EditedFieldInfo;
    numeroDocumento?: EditedFieldInfo;
    pixKey?: EditedFieldInfo;
  };
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

interface EditableFields {
  valor: string;
  vencimento: string;
  linhaDigitavel: string;
  codigoBarras: string;
  fornecedor: string;
  cnpj: string;
  numeroDocumento: string;
  pixKey: string;
}

interface OriginalFields {
  valor: number;
  vencimento: string | null;
  linhaDigitavel: string | null;
  codigoBarras: string | null;
  fornecedor: string | null;
  cnpj: string | null;
  numeroDocumento: string | null;
  pixKey: string | null;
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

  // Global edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [showEditError, setShowEditError] = useState(false);

  // Original values from OCR
  const originalValue = result.netValue || result.totalValue || 0;
  const originalFields: OriginalFields = {
    valor: originalValue,
    vencimento: result.dueDate || result.issueDate || null,
    linhaDigitavel: result.linhaDigitavel || null,
    codigoBarras: result.codigoBarras || null,
    fornecedor: result.issuerName || null,
    cnpj: result.issuerCnpj || null,
    numeroDocumento: result.documentNumber || null,
    pixKey: result.pixKey || null,
  };

  // Editable values
  const [editedFields, setEditedFields] = useState<EditableFields>({
    valor: originalValue.toString(),
    vencimento: originalFields.vencimento || '',
    linhaDigitavel: originalFields.linhaDigitavel || '',
    codigoBarras: originalFields.codigoBarras || '',
    fornecedor: originalFields.fornecedor || '',
    cnpj: originalFields.cnpj || '',
    numeroDocumento: originalFields.numeroDocumento || '',
    pixKey: originalFields.pixKey || '',
  });

  // Reset editing state when modal opens/closes or result changes
  useEffect(() => {
    if (open) {
      setEditedFields({
        valor: (result.netValue || result.totalValue || 0).toString(),
        vencimento: result.dueDate || result.issueDate || '',
        linhaDigitavel: result.linhaDigitavel || '',
        codigoBarras: result.codigoBarras || '',
        fornecedor: result.issuerName || '',
        cnpj: result.issuerCnpj || '',
        numeroDocumento: result.documentNumber || '',
        pixKey: result.pixKey || '',
      });
      setIsEditMode(false);
      setEditReason('');
      setShowEditError(false);
    }
  }, [open, result]);

  const isRevenue = selectedType === 'revenue';
  const isExpense = selectedType === 'expense' || isTaxDoc;
  const confidencePercent = Math.round((result.confidence || 0) * 100);
  const isLowConfidence = confidencePercent < 70;
  const isUnknown = result.type === 'unknown';

  // Check if a specific field was edited
  const wasFieldEdited = (field: keyof EditableFields): boolean => {
    if (field === 'valor') {
      const parsed = parseFloat(editedFields.valor.replace(',', '.')) || 0;
      return Math.abs(parsed - originalFields.valor) > 0.01;
    }
    const original = originalFields[field] || '';
    const edited = editedFields[field] || '';
    return original !== edited && edited !== '';
  };

  // Check if any field was edited
  const hasAnyFieldEdited = (): boolean => {
    return (
      wasFieldEdited('valor') ||
      wasFieldEdited('vencimento') ||
      wasFieldEdited('linhaDigitavel') ||
      wasFieldEdited('codigoBarras') ||
      wasFieldEdited('fornecedor') ||
      wasFieldEdited('cnpj') ||
      wasFieldEdited('numeroDocumento') ||
      wasFieldEdited('pixKey')
    );
  };

  // Get list of edited fields for display
  const getEditedFieldsList = (): string[] => {
    const fields: string[] = [];
    if (wasFieldEdited('valor')) fields.push('Valor');
    if (wasFieldEdited('vencimento')) fields.push('Vencimento');
    if (wasFieldEdited('linhaDigitavel')) fields.push('Linha Digitável');
    if (wasFieldEdited('codigoBarras')) fields.push('Código de Barras');
    if (wasFieldEdited('fornecedor')) fields.push('Fornecedor');
    if (wasFieldEdited('cnpj')) fields.push('CNPJ');
    if (wasFieldEdited('numeroDocumento')) fields.push('Nº Documento');
    if (wasFieldEdited('pixKey')) fields.push('Chave PIX');
    return fields;
  };

  const parsedEditedValue = parseFloat(editedFields.valor.replace(',', '.')) || 0;

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

  const handleToggleEditMode = () => {
    if (isEditMode) {
      // Exiting edit mode - check if there are unsaved edits
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
  };

  const handleFieldChange = (field: keyof EditableFields, value: string) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const buildFieldsEditedObject = (): OcrEditInfo['fieldsEdited'] => {
    const fieldsEdited: OcrEditInfo['fieldsEdited'] = {};
    
    if (wasFieldEdited('valor')) {
      fieldsEdited.valor = { original: originalFields.valor, edited: parsedEditedValue };
    }
    if (wasFieldEdited('vencimento')) {
      fieldsEdited.vencimento = { original: originalFields.vencimento, edited: editedFields.vencimento };
    }
    if (wasFieldEdited('linhaDigitavel')) {
      fieldsEdited.linhaDigitavel = { original: originalFields.linhaDigitavel, edited: editedFields.linhaDigitavel };
    }
    if (wasFieldEdited('codigoBarras')) {
      fieldsEdited.codigoBarras = { original: originalFields.codigoBarras, edited: editedFields.codigoBarras };
    }
    if (wasFieldEdited('fornecedor')) {
      fieldsEdited.fornecedor = { original: originalFields.fornecedor, edited: editedFields.fornecedor };
    }
    if (wasFieldEdited('cnpj')) {
      fieldsEdited.cnpj = { original: originalFields.cnpj, edited: editedFields.cnpj };
    }
    if (wasFieldEdited('numeroDocumento')) {
      fieldsEdited.numeroDocumento = { original: originalFields.numeroDocumento, edited: editedFields.numeroDocumento };
    }
    if (wasFieldEdited('pixKey')) {
      fieldsEdited.pixKey = { original: originalFields.pixKey, edited: editedFields.pixKey };
    }
    
    return fieldsEdited;
  };

  const handleConfirm = () => {
    // Validate edit reason if any field was changed
    if (hasAnyFieldEdited() && editReason.trim().length < 10) {
      setShowEditError(true);
      toast.error('Informe a justificativa da correção (mínimo 10 caracteres)');
      return;
    }

    const ocrEdit: OcrEditInfo | undefined = hasAnyFieldEdited() ? {
      ocrValueEdited: wasFieldEdited('valor'),
      ocrOriginalValue: originalFields.valor,
      ocrEditReason: editReason.trim(),
      editedValue: parsedEditedValue,
      fieldsEdited: buildFieldsEditedObject(),
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

  // Render an editable or static field
  const renderEditableField = (
    field: keyof EditableFields,
    label: string,
    icon: React.ReactNode,
    type: 'text' | 'date' | 'currency' = 'text',
    placeholder?: string
  ) => {
    const edited = wasFieldEdited(field);
    const value = editedFields[field];
    
    if (isEditMode) {
      return (
        <div className="flex items-center gap-2 text-sm">
          {icon}
          <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
          <Input
            type={type === 'date' ? 'date' : 'text'}
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className={`h-7 text-sm flex-1 ${edited ? 'border-amber-500' : ''}`}
            placeholder={placeholder}
          />
        </div>
      );
    }

    // Static display
    let displayValue: string;
    if (type === 'currency') {
      displayValue = formatCurrency(parsedEditedValue);
    } else if (type === 'date') {
      displayValue = formatDate(value) || '-';
    } else {
      displayValue = value || '-';
    }

    return (
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className="text-muted-foreground">{label}:</span>
        <span className={`${type === 'currency' ? 'font-semibold' : ''} ${edited ? 'text-amber-600' : ''}`}>
          {displayValue}
        </span>
        {edited && (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
            Corrigido
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isTaxDoc ? (
                <Landmark className="h-5 w-5 text-blue-600" />
              ) : isRevenue ? (
                <FileText className="h-5 w-5 text-emerald-600" />
              ) : (
                <Receipt className="h-5 w-5 text-amber-600" />
              )}
              Confirmar Classificação
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleEditMode}
              className={`gap-2 ${isEditMode ? 'text-amber-600 bg-amber-50' : 'text-muted-foreground'}`}
              title={isEditMode ? "Sair do modo edição" : "Editar dados extraídos"}
            >
              {isEditMode ? (
                <>
                  <X className="h-4 w-4" />
                  Fechar Edição
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Editar
                </>
              )}
            </Button>
          </DialogTitle>
          <DialogDescription>
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Edit Mode Banner */}
          {isEditMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Pencil className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                <span className="font-medium">Modo de edição ativo.</span> Altere os campos que precisam de correção.
              </p>
            </div>
          )}

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
          {(originalFields.codigoBarras || originalFields.linhaDigitavel || originalFields.pixKey) && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Dados para Pagamento
              </h4>
              
              {/* Linha Digitável */}
              {(originalFields.linhaDigitavel || isEditMode) && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Linha Digitável</span>
                    {isEditMode ? (
                      <Input
                        value={editedFields.linhaDigitavel}
                        onChange={(e) => handleFieldChange('linhaDigitavel', e.target.value)}
                        className={`font-mono text-xs h-7 ${wasFieldEdited('linhaDigitavel') ? 'border-amber-500' : ''}`}
                        placeholder="Linha digitável do boleto"
                      />
                    ) : (
                      <p className={`text-xs font-mono truncate ${wasFieldEdited('linhaDigitavel') ? 'text-amber-600' : ''}`}>
                        {editedFields.linhaDigitavel || '-'}
                        {wasFieldEdited('linhaDigitavel') && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-600">
                            Corrigido
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>
                  {!isEditMode && editedFields.linhaDigitavel && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopy(editedFields.linhaDigitavel, 'Linha digitável')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}

              {/* Código de Barras */}
              {(originalFields.codigoBarras || isEditMode) && !originalFields.linhaDigitavel && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Código de Barras</span>
                    {isEditMode ? (
                      <Input
                        value={editedFields.codigoBarras}
                        onChange={(e) => handleFieldChange('codigoBarras', e.target.value)}
                        className={`font-mono text-xs h-7 ${wasFieldEdited('codigoBarras') ? 'border-amber-500' : ''}`}
                        placeholder="Código de barras"
                      />
                    ) : (
                      <p className={`text-xs font-mono truncate ${wasFieldEdited('codigoBarras') ? 'text-amber-600' : ''}`}>
                        {editedFields.codigoBarras || '-'}
                        {wasFieldEdited('codigoBarras') && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-600">
                            Corrigido
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>
                  {!isEditMode && editedFields.codigoBarras && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopy(editedFields.codigoBarras, 'Código de barras')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}

              {/* PIX Key */}
              {(originalFields.pixKey || isEditMode) && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">
                      Chave PIX ({result.pixTipo || 'desconhecido'})
                    </span>
                    {isEditMode ? (
                      <Input
                        value={editedFields.pixKey}
                        onChange={(e) => handleFieldChange('pixKey', e.target.value)}
                        className={`font-mono text-xs h-7 ${wasFieldEdited('pixKey') ? 'border-amber-500' : ''}`}
                        placeholder="Chave PIX"
                      />
                    ) : (
                      <p className={`text-xs font-mono truncate ${wasFieldEdited('pixKey') ? 'text-amber-600' : ''}`}>
                        {editedFields.pixKey || '-'}
                        {wasFieldEdited('pixKey') && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-600">
                            Corrigido
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>
                  {!isEditMode && editedFields.pixKey && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopy(editedFields.pixKey, 'Chave PIX')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Extracted data */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Dados Extraídos</h4>
            
            <div className="grid gap-2">
              {/* Issuer/Fornecedor */}
              {renderEditableField(
                'fornecedor',
                isTaxDoc ? 'Contribuinte' : isRevenue ? 'Cliente' : 'Fornecedor',
                <Building2 className="h-4 w-4 text-muted-foreground" />,
                'text',
                'Nome do fornecedor'
              )}

              {/* CNPJ */}
              {(originalFields.cnpj || isEditMode) && (
                <div className="pl-6">
                  {renderEditableField(
                    'cnpj',
                    'CNPJ',
                    <span className="w-4" />,
                    'text',
                    '00.000.000/0000-00'
                  )}
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
              {renderEditableField(
                'valor',
                'Valor',
                <DollarSign className="h-4 w-4 text-muted-foreground" />,
                'currency',
                '0,00'
              )}

              {/* Date/Vencimento */}
              {renderEditableField(
                'vencimento',
                isRevenue ? 'Emissão' : 'Vencimento',
                <Calendar className="h-4 w-4 text-muted-foreground" />,
                'date'
              )}

              {/* Document number */}
              {(originalFields.numeroDocumento || isEditMode) && (
                <div className="pl-6">
                  {renderEditableField(
                    'numeroDocumento',
                    'Nº Doc',
                    <Hash className="h-3 w-3 text-muted-foreground" />,
                    'text',
                    'Número do documento'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Edit Justification Area */}
          {hasAnyFieldEdited() && (
            <div className="space-y-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Dados corrigidos manualmente</span>
              </div>
              
              <div className="text-xs text-amber-600 mb-2">
                Campos alterados: {getEditedFieldsList().join(', ')}
              </div>
              
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
                placeholder="Explique por que está corrigindo os dados (mínimo 10 caracteres)"
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
