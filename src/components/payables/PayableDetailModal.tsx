import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Check, Download, ExternalLink, Pencil, X, Copy, Save, Loader2, Upload, Sparkles } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useUpdatePayable } from '@/features/payables/hooks/usePayables';
import { useBoletoOcr } from '@/features/payables/hooks/usePayableOcr';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Payable, BoletoOcrResult } from '@/types/payables';
import { Calendar as CalendarIcon } from 'lucide-react';

interface PayableDetailModalProps {
  payable: Payable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsPaid?: (payable: Payable) => void;
  onPayableUpdated?: () => void;
}

interface FormData {
  beneficiario: string;
  valor: number;
  vencimento: Date;
  beneficiario_cnpj: string;
  description: string;
  linha_digitavel: string;
}

export function PayableDetailModal({
  payable,
  open,
  onOpenChange,
  onMarkAsPaid,
  onPayableUpdated,
}: PayableDetailModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrSuggestion, setOcrSuggestion] = useState<BoletoOcrResult | null>(null);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    beneficiario: '',
    valor: 0,
    vencimento: new Date(),
    beneficiario_cnpj: '',
    description: '',
    linha_digitavel: '',
  });

  const updatePayable = useUpdatePayable();
  const { processFile: processOcr, isProcessing: isOcrProcessing } = useBoletoOcr();

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setNewFile(null);
      setOcrSuggestion(null);
      setShowOcrDialog(false);
    }
    if (payable) {
      setFormData({
        beneficiario: payable.beneficiario || '',
        valor: payable.valor,
        vencimento: new Date(payable.vencimento),
        beneficiario_cnpj: payable.beneficiario_cnpj || '',
        description: payable.description || '',
        linha_digitavel: payable.linha_digitavel || '',
      });
    }
  }, [payable, open]);

  useEffect(() => {
    if (payable?.file_path && open) {
      loadPdfUrl(payable.file_path);
    } else {
      setPdfUrl(null);
    }
  }, [payable?.file_path, open]);

  const loadPdfUrl = async (filePath: string) => {
    setLoadingPdf(true);
    try {
      const { data, error } = await supabase.storage
        .from('payables')
        .createSignedUrl(filePath, 3600);
      
      if (error) throw error;
      setPdfUrl(data.signedUrl);
    } catch (err) {
      console.error('Erro ao carregar PDF:', err);
      setPdfUrl(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleCopyLinhaDigitavel = () => {
    if (payable?.linha_digitavel) {
      navigator.clipboard.writeText(payable.linha_digitavel);
      toast({
        title: 'Copiado!',
        description: 'Linha digitável copiada para a área de transferência.',
      });
    }
  };

  // Check if OCR result has relevant changes compared to current form data
  const hasRelevantChanges = (ocr: BoletoOcrResult): boolean => {
    const valorDiff = ocr.valor && Math.abs(ocr.valor - formData.valor) > 0.01;
    const vencimentoDiff = ocr.vencimento && ocr.vencimento !== format(formData.vencimento, 'yyyy-MM-dd');
    const beneficiarioDiff = ocr.beneficiario && ocr.beneficiario.toLowerCase() !== formData.beneficiario.toLowerCase();
    return !!(valorDiff || vencimentoDiff || beneficiarioDiff);
  };

  // Handle file selection with automatic OCR
  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setNewFile(null);
      return;
    }
    
    setNewFile(file);

    // Trigger OCR automatically
    try {
      const result = await processOcr(file);
      if (result && hasRelevantChanges(result)) {
        setOcrSuggestion(result);
        setShowOcrDialog(true);
      } else if (result) {
        toast({
          title: 'OCR concluído',
          description: 'Nenhuma alteração detectada no documento.',
        });
      }
    } catch (error) {
      console.log('OCR failed, user can fill manually:', error);
      // Don't show error, OCR is optional enhancement
    }
  };

  // Apply OCR suggestions to form
  const applyOcrSuggestion = () => {
    if (ocrSuggestion) {
      setFormData({
        ...formData,
        ...(ocrSuggestion.valor && { valor: ocrSuggestion.valor }),
        ...(ocrSuggestion.vencimento && { vencimento: new Date(ocrSuggestion.vencimento) }),
        ...(ocrSuggestion.beneficiario && { beneficiario: ocrSuggestion.beneficiario }),
        ...(ocrSuggestion.beneficiario_cnpj && { beneficiario_cnpj: ocrSuggestion.beneficiario_cnpj }),
        ...(ocrSuggestion.linha_digitavel && { linha_digitavel: ocrSuggestion.linha_digitavel }),
      });
      toast({
        title: 'Dados atualizados',
        description: 'Os campos foram preenchidos com os dados do documento.',
      });
    }
    setShowOcrDialog(false);
    setOcrSuggestion(null);
  };

  const formatCurrencyCompare = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSave = async () => {
    if (!payable) return;
    setIsUploading(true);

    try {
      let filePath = payable.file_path;
      let fileName = payable.file_name;

      // Upload new file if selected
      if (newFile) {
        const fileExt = newFile.name.split('.').pop();
        const newFilePath = `boletos/${payable.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('payables')
          .upload(newFilePath, newFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }
        filePath = newFilePath;
        fileName = newFile.name;
      }

      updatePayable.mutate(
        {
          id: payable.id,
          data: {
            beneficiario: formData.beneficiario,
            valor: formData.valor,
            vencimento: format(formData.vencimento, 'yyyy-MM-dd'),
            beneficiario_cnpj: formData.beneficiario_cnpj || undefined,
            description: formData.description || undefined,
            linha_digitavel: formData.linha_digitavel || undefined,
            file_path: filePath || undefined,
            file_name: fileName || undefined,
          },
        },
        {
          onSuccess: () => {
            setIsEditing(false);
            setNewFile(null);
            onPayableUpdated?.();
          },
          onSettled: () => {
            setIsUploading(false);
          },
        }
      );
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar as alterações.',
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  };

  const handleCancelEdit = () => {
    if (payable) {
      setFormData({
        beneficiario: payable.beneficiario || '',
        valor: payable.valor,
        vencimento: new Date(payable.vencimento),
        beneficiario_cnpj: payable.beneficiario_cnpj || '',
        description: payable.description || '',
        linha_digitavel: payable.linha_digitavel || '',
      });
    }
    setIsEditing(false);
    setNewFile(null);
  };

  if (!payable) return null;

  const isOverdue = payable.status === 'pendente' && new Date(payable.vencimento) < new Date();

  const getStatusBadge = () => {
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pendente: 'secondary',
      pago: 'outline',
      cancelado: 'destructive',
    };
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      pago: 'Pago',
      cancelado: 'Cancelado',
    };
    return <Badge variant={variants[payable.status] || 'secondary'}>{labels[payable.status] || payable.status}</Badge>;
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '-'}</span>
    </div>
  );

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isEditing ? 'Editar Boleto' : 'Detalhes do Boleto'}</span>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {!isEditing && payable.status === 'pendente' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing ? (
            // Edit Mode
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiario">Beneficiário</Label>
                <Input
                  id="beneficiario"
                  value={formData.beneficiario}
                  onChange={(e) => setFormData({ ...formData, beneficiario: e.target.value })}
                  placeholder="Nome do beneficiário"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.vencimento && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.vencimento
                          ? format(formData.vencimento, 'dd/MM/yyyy', { locale: ptBR })
                          : 'Selecione'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.vencimento}
                        onSelect={(date) => date && setFormData({ ...formData, vencimento: date })}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ do Beneficiário</Label>
                <Input
                  id="cnpj"
                  value={formData.beneficiario_cnpj}
                  onChange={(e) => setFormData({ ...formData, beneficiario_cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição ou observações"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linha_digitavel">Linha Digitável</Label>
                <Input
                  id="linha_digitavel"
                  value={formData.linha_digitavel}
                  onChange={(e) => setFormData({ ...formData, linha_digitavel: e.target.value })}
                  placeholder="Digite a linha digitável do boleto"
                  className="font-mono"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Documento Anexo</Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                      isOcrProcessing && "opacity-50 pointer-events-none"
                    )}>
                      {isOcrProcessing ? (
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {isOcrProcessing 
                          ? 'Processando OCR...' 
                          : newFile 
                            ? newFile.name 
                            : 'Selecionar novo arquivo...'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      className="hidden"
                      disabled={isOcrProcessing}
                    />
                  </label>
                  {newFile && !isOcrProcessing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNewFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {payable.file_name && !newFile && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo atual: {payable.file_name}
                  </p>
                )}
                {isOcrProcessing && (
                  <p className="text-sm text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Extraindo dados automaticamente...
                  </p>
                )}
              </div>
            </div>
          ) : (
            // View Mode
            <>
              {/* Header Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-1">{payable.beneficiario || 'Beneficiário não informado'}</h3>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(payable.valor)}
                </p>
              </div>

              {/* Basic Info */}
              <div className="divide-y">
                <InfoRow 
                  label="Vencimento" 
                  value={format(new Date(payable.vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} 
                />
                {payable.parcela_numero && payable.parcela_total && (
                  <InfoRow 
                    label="Parcela" 
                    value={`${payable.parcela_numero} de ${payable.parcela_total}`} 
                  />
                )}
                {payable.beneficiario_cnpj && (
                  <InfoRow label="CNPJ" value={payable.beneficiario_cnpj} />
                )}
                {payable.banco_nome && (
                  <InfoRow 
                    label="Banco" 
                    value={`${payable.banco_nome}${payable.banco_codigo ? ` (${payable.banco_codigo})` : ''}`} 
                  />
                )}
                {payable.description && (
                  <InfoRow label="Descrição" value={payable.description} />
                )}
              </div>

              {/* Linha Digitável */}
              {payable.linha_digitavel && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">Linha digitável</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyLinhaDigitavel}
                      className="h-8 gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                    {payable.linha_digitavel}
                  </div>
                </div>
              )}

              {/* Payment Info (if paid) */}
              {payable.status === 'pago' && payable.paid_at && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-600 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Pagamento Realizado
                    </h4>
                    <div className="divide-y">
                      <InfoRow 
                        label="Data do pagamento" 
                        value={format(new Date(payable.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
                      />
                      {payable.paid_amount && (
                        <InfoRow 
                          label="Valor pago" 
                          value={formatCurrency(payable.paid_amount)} 
                        />
                      )}
                      {payable.paid_method && (
                        <InfoRow label="Método" value={payable.paid_method} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* PDF Viewer - shown in both modes */}
          {payable.file_path && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documento Anexo
                  </h4>
                  {pdfUrl && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={pdfUrl} download={payable.file_name || 'boleto.pdf'}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                
                {loadingPdf ? (
                  <div className="h-96 flex items-center justify-center bg-muted rounded-md">
                    <span className="text-muted-foreground">Carregando documento...</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-96 rounded-md border"
                    title="Visualização do boleto"
                  />
                ) : (
                  <div className="h-32 flex items-center justify-center bg-muted rounded-md">
                    <span className="text-muted-foreground">Não foi possível carregar o documento</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={updatePayable.isPending}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updatePayable.isPending}>
                {updatePayable.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <>
              {payable.status === 'pendente' && onMarkAsPaid && (
                <Button onClick={() => onMarkAsPaid(payable)} className="gap-2">
                  <Check className="h-4 w-4" />
                  Marcar como Pago
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* OCR Suggestion Dialog */}
      <AlertDialog open={showOcrDialog} onOpenChange={setShowOcrDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Dados Detectados no Documento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Detectamos informações diferentes no documento enviado:</p>
                {ocrSuggestion && (
                  <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                    {ocrSuggestion.valor && Math.abs(ocrSuggestion.valor - formData.valor) > 0.01 && (
                      <div className="flex justify-between">
                        <span>Valor:</span>
                        <span>
                          <span className="text-muted-foreground line-through mr-2">
                            {formatCurrencyCompare(formData.valor)}
                          </span>
                          <span className="text-primary font-medium">
                            {formatCurrencyCompare(ocrSuggestion.valor)}
                          </span>
                        </span>
                      </div>
                    )}
                    {ocrSuggestion.vencimento && ocrSuggestion.vencimento !== format(formData.vencimento, 'yyyy-MM-dd') && (
                      <div className="flex justify-between">
                        <span>Vencimento:</span>
                        <span>
                          <span className="text-muted-foreground line-through mr-2">
                            {format(formData.vencimento, 'dd/MM/yyyy')}
                          </span>
                          <span className="text-primary font-medium">
                            {format(new Date(ocrSuggestion.vencimento), 'dd/MM/yyyy')}
                          </span>
                        </span>
                      </div>
                    )}
                    {ocrSuggestion.beneficiario && ocrSuggestion.beneficiario.toLowerCase() !== formData.beneficiario.toLowerCase() && (
                      <div className="flex justify-between">
                        <span>Beneficiário:</span>
                        <span className="text-primary font-medium text-right max-w-[200px] truncate">
                          {ocrSuggestion.beneficiario}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-muted-foreground">Deseja atualizar os campos com os novos dados?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOcrSuggestion(null)}>
              Manter Dados Atuais
            </AlertDialogCancel>
            <AlertDialogAction onClick={applyOcrSuggestion}>
              Atualizar Campos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
