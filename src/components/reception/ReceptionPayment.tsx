import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, CreditCard, Smartphone, Upload, Loader2, CheckCircle, AlertTriangle, Search, Clipboard, Plus, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  usePayables, 
  useMarkPayableAsPaid, 
  useCreatePayableAndMarkAsPaid,
  useUpdatePayableFile 
} from '@/features/payables/hooks/usePayables';
import { 
  ocrBoleto, 
  ocrReceipt, 
  fileToBase64, 
  uploadPayableFile,
  normalizeBoletoOcr, 
  normalizeReceiptOcr,
  NormalizedPaymentOcr 
} from '@/features/payables/api/ocr.api';
import { Payable } from '@/types/payables';
import { format } from 'date-fns';

type PaymentStep = 'type' | 'upload' | 'review' | 'success';
type PaymentType = 'boleto' | 'pix';

interface ReceptionPaymentProps {
  onBack: () => void;
  unitId: string | null;
}

interface MatchResult {
  payable: Payable;
  confidence: number;
  matchType: 'linha_digitavel' | 'valor_data' | 'beneficiario';
}

export function ReceptionPayment({ onBack, unitId }: ReceptionPaymentProps) {
  const [step, setStep] = useState<PaymentStep>('type');
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<NormalizedPaymentOcr | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [matchedPayable, setMatchedPayable] = useState<MatchResult | null>(null);
  const [possibleMatches, setPossibleMatches] = useState<MatchResult[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  const { data: pendingPayables = [], isLoading: isLoadingPayables } = usePayables({ 
    status: 'pendente',
    unitId: unitId || undefined 
  });
  const markAsPaid = useMarkPayableAsPaid();
  const createAndMarkAsPaid = useCreatePayableAndMarkAsPaid();
  const updateFile = useUpdatePayableFile();

  // Handle clipboard paste
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileUpload(file);
        }
        return;
      }
    }
  }, [paymentType]);

  useEffect(() => {
    if (step === 'upload') {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [step, handlePaste]);

  // Generate preview URL for uploaded file
  useEffect(() => {
    if (uploadedFile && uploadedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(uploadedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return () => setPreviewUrl(null);
  }, [uploadedFile]);

  const findMatches = (normalizedOcr: NormalizedPaymentOcr): MatchResult[] => {
    const matches: MatchResult[] = [];

    for (const payable of pendingPayables) {
      // Match by linha digitavel (exact) - only for boleto
      if (normalizedOcr.identificador && payable.linha_digitavel) {
        const ocrLinha = normalizedOcr.identificador.replace(/[\s.]/g, '');
        const payableLinha = payable.linha_digitavel.replace(/[\s.]/g, '');
        if (ocrLinha === payableLinha) {
          matches.push({ payable, confidence: 100, matchType: 'linha_digitavel' });
          continue;
        }
      }

      // Match by value + due date
      if (normalizedOcr.valor && normalizedOcr.data) {
        const valueDiff = Math.abs((payable.valor || 0) - normalizedOcr.valor);
        const valueMatch = valueDiff < 0.01;
        const dateMatch = payable.vencimento === normalizedOcr.data;
        
        if (valueMatch && dateMatch) {
          matches.push({ payable, confidence: 95, matchType: 'valor_data' });
          continue;
        }
        
        // Close value match (within 1%)
        if (normalizedOcr.valor > 0 && valueDiff / normalizedOcr.valor < 0.01 && dateMatch) {
          matches.push({ payable, confidence: 85, matchType: 'valor_data' });
          continue;
        }
      }

      // Match by beneficiary name
      if (normalizedOcr.beneficiario && payable.beneficiario) {
        const ocrBenef = normalizedOcr.beneficiario.toLowerCase().trim();
        const payableBenef = payable.beneficiario.toLowerCase().trim();
        
        if (ocrBenef.includes(payableBenef) || payableBenef.includes(ocrBenef)) {
          if (normalizedOcr.valor && payable.valor) {
            const valueDiff = Math.abs((payable.valor || 0) - normalizedOcr.valor);
            if (normalizedOcr.valor > 0 && valueDiff / normalizedOcr.valor < 0.05) {
              matches.push({ payable, confidence: 75, matchType: 'beneficiario' });
            }
          }
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setOcrError(null);
    setUploadedFile(file);
    
    try {
      const { base64, mimeType } = await fileToBase64(file);
      
      let normalizedResult: NormalizedPaymentOcr;
      
      if (paymentType === 'boleto') {
        const boletoResult = await ocrBoleto(base64, mimeType);
        normalizedResult = normalizeBoletoOcr(boletoResult);
      } else {
        const receiptResult = await ocrReceipt(base64, mimeType);
        normalizedResult = normalizeReceiptOcr(receiptResult);
      }
      
      // Check if OCR returned useful data
      if (!normalizedResult.valor && !normalizedResult.beneficiario) {
        setOcrError('Não foi possível extrair dados do comprovante. Tente outra foto ou preencha manualmente.');
        setOcrData(normalizedResult);
        setPaidAmount(null);
        setStep('review');
        return;
      }
      
      setOcrData(normalizedResult);
      setPaidAmount(normalizedResult.valor || null);
      
      // Find matches
      const matches = findMatches(normalizedResult);
      setPossibleMatches(matches);
      
      if (matches.length > 0 && matches[0].confidence >= 80) {
        setMatchedPayable(matches[0]);
      }
      
      setStep('review');
    } catch (error) {
      console.error('OCR error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setOcrError(`Erro ao processar: ${errorMessage}`);
      toast.error('Erro ao processar comprovante', {
        description: errorMessage,
      });
      // Still go to review so user can see the error and retry or enter manually
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `clipboard-${Date.now()}.png`, { type });
            handleFileUpload(file);
            return;
          }
        }
      }
      toast.error('Nenhuma imagem encontrada', {
        description: 'Copie uma imagem antes de colar.',
      });
    } catch (error) {
      console.error('Clipboard error:', error);
      toast.error('Erro ao acessar clipboard', {
        description: 'Verifique as permissões do navegador.',
      });
    }
  };

  const handleManualCodeSearch = async () => {
    if (!manualCode.trim()) return;
    
    setIsProcessing(true);
    const cleanCode = manualCode.replace(/[\s.]/g, '');
    
    const matches = pendingPayables.filter(p => {
      if (!p.linha_digitavel) return false;
      const payableLinha = p.linha_digitavel.replace(/[\s.]/g, '');
      return payableLinha === cleanCode || payableLinha.includes(cleanCode);
    });
    
    if (matches.length > 0) {
      const matchResult: MatchResult = {
        payable: matches[0],
        confidence: 100,
        matchType: 'linha_digitavel',
      };
      setMatchedPayable(matchResult);
      setPossibleMatches([matchResult]);
      setPaidAmount(matches[0].valor || null);
      setOcrData({
        valor: matches[0].valor,
        data: matches[0].vencimento,
        beneficiario: matches[0].beneficiario,
        identificador: manualCode,
        tipo: paymentType || 'boleto',
        confidence: 100,
        raw: {} as any,
      });
      setStep('review');
    } else {
      toast.error('Nenhuma despesa encontrada', {
        description: 'Não foi possível encontrar uma despesa pendente com esse código.',
      });
    }
    
    setIsProcessing(false);
  };

  const handleConfirmPayment = async () => {
    if (!matchedPayable) return;
    
    setIsProcessing(true);
    
    try {
      // Upload file if we have one
      let filePath: string | undefined;
      let fileName: string | undefined;
      
      if (uploadedFile) {
        try {
          const folder = paymentType === 'boleto' ? 'boletos' : 'receipts';
          const uploadResult = await uploadPayableFile(uploadedFile, folder);
          filePath = uploadResult.path;
          fileName = uploadedFile.name;
        } catch (uploadError) {
          console.warn('File upload failed, continuing without attachment:', uploadError);
        }
      }
      
      await markAsPaid.mutateAsync({
        id: matchedPayable.payable.id,
        paidAmount: paidAmount || matchedPayable.payable.valor || 0,
        paidMethod: paymentType === 'pix' ? 'pix' : 'boleto',
      });
      
      // Update file if we uploaded one
      if (filePath && fileName) {
        try {
          await updateFile.mutateAsync({
            id: matchedPayable.payable.id,
            filePath,
            fileName,
          });
        } catch (fileError) {
          console.warn('Failed to attach file to payable:', fileError);
        }
      }
      
      setStep('success');
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAndPay = async () => {
    if (!ocrData) return;
    
    setIsProcessing(true);
    
    try {
      // Upload file if we have one
      let filePath: string | undefined;
      let fileName: string | undefined;
      
      if (uploadedFile) {
        try {
          const folder = paymentType === 'boleto' ? 'boletos' : 'receipts';
          const uploadResult = await uploadPayableFile(uploadedFile, folder);
          filePath = uploadResult.path;
          fileName = uploadedFile.name;
        } catch (uploadError) {
          console.warn('File upload failed, continuing without attachment:', uploadError);
        }
      }
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      await createAndMarkAsPaid.mutateAsync({
        data: {
          beneficiario: ocrData.beneficiario || 'Não identificado',
          valor: paidAmount || ocrData.valor || 0,
          vencimento: ocrData.data || today,
          tipo: paymentType || 'pix',
          linha_digitavel: ocrData.tipo === 'boleto' && ocrData.identificador ? ocrData.identificador : undefined,
          unit_id: unitId || undefined,
        },
        paidAmount: paidAmount || ocrData.valor || 0,
        paidMethod: paymentType === 'pix' ? 'pix' : 'boleto',
        filePath,
        fileName,
      });
      
      setStep('success');
    } catch (error) {
      console.error('Error creating and paying:', error);
      toast.error('Erro ao criar e registrar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectPayable = (match: MatchResult) => {
    setMatchedPayable(match);
    setPaidAmount(match.payable.valor || ocrData?.valor || null);
  };

  const handleReset = () => {
    setStep('type');
    setPaymentType(null);
    setOcrData(null);
    setOcrError(null);
    setMatchedPayable(null);
    setPossibleMatches([]);
    setManualCode('');
    setPaidAmount(null);
    setUploadedFile(null);
    setPreviewUrl(null);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Step: Choose payment type
  if (step === 'type') {
    return (
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <h2 className="text-2xl font-bold text-center mb-8">Registrar Pagamento</h2>

        {/* Debug info */}
        <div className="text-sm text-muted-foreground text-center mb-4">
          {isLoadingPayables ? (
            <span>Carregando despesas...</span>
          ) : (
            <span>Despesas pendentes carregadas: {pendingPayables.length}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Button
            variant="outline"
            className="h-40 flex flex-col items-center justify-center gap-4 text-xl font-semibold border-2 hover:border-primary hover:bg-primary/5"
            onClick={() => {
              setPaymentType('boleto');
              setStep('upload');
            }}
          >
            <CreditCard className="h-12 w-12 text-primary" />
            <div className="text-center">
              <div>Boleto</div>
              <div className="text-sm font-normal text-muted-foreground mt-1">
                Comprovante de pagamento
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-40 flex flex-col items-center justify-center gap-4 text-xl font-semibold border-2 hover:border-primary hover:bg-primary/5"
            onClick={() => {
              setPaymentType('pix');
              setStep('upload');
            }}
          >
            <Smartphone className="h-12 w-12 text-primary" />
            <div className="text-center">
              <div>PIX</div>
              <div className="text-sm font-normal text-muted-foreground mt-1">
                Comprovante de transferência
              </div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  // Step: Upload/capture proof
  if (step === 'upload') {
    return (
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" onClick={() => setStep('type')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <h2 className="text-2xl font-bold text-center mb-2">
          Enviar Comprovante de {paymentType === 'boleto' ? 'Boleto' : 'PIX'}
        </h2>
        <p className="text-muted-foreground text-center mb-2">
          Tire uma foto, selecione um arquivo ou cole uma imagem (Ctrl+V)
        </p>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Despesas pendentes disponíveis: {pendingPayables.length}
        </p>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processando comprovante...</p>
            <p className="text-muted-foreground">Extraindo dados e buscando despesa</p>
          </div>
        ) : (
          <>
            {/* Upload area */}
            <Card 
              ref={uploadAreaRef}
              className="border-2 border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">Clique para enviar arquivo</p>
                <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Formatos: JPG, PNG, PDF
                </p>
              </CardContent>
            </Card>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            {/* Paste from clipboard button */}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={handlePasteFromClipboard}
            >
              <Clipboard className="h-4 w-4 mr-2" />
              Colar imagem do clipboard (Ctrl+V)
            </Button>

            {/* Manual code input */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou digite o código
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="manual-code" className="sr-only">
                    Linha digitável ou código
                  </Label>
                  <Input
                    id="manual-code"
                    placeholder={paymentType === 'boleto' ? 'Linha digitável do boleto' : 'Código/ID da transação PIX'}
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="text-lg py-6"
                  />
                </div>
                <Button 
                  onClick={handleManualCodeSearch}
                  disabled={!manualCode.trim() || isProcessing}
                  size="lg"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Step: Review and confirm
  if (step === 'review') {
    const hasOcrData = ocrData && (ocrData.valor || ocrData.beneficiario);
    const canConfirmExisting = !!matchedPayable;
    const canCreateNew = hasOcrData || paidAmount;

    return (
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" onClick={() => setStep('upload')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <h2 className="text-2xl font-bold text-center mb-6">Revisar Pagamento</h2>

        {/* OCR Error */}
        {ocrError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{ocrError}</AlertDescription>
          </Alert>
        )}

        {/* Preview of uploaded file */}
        {previewUrl && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Comprovante enviado</span>
              </div>
              <img 
                src={previewUrl} 
                alt="Comprovante" 
                className="max-h-48 mx-auto rounded border"
              />
            </CardContent>
          </Card>
        )}

        {/* OCR extracted data */}
        {hasOcrData && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Dados do Comprovante</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Beneficiário:</span>
                  <p className="font-medium">{ocrData.beneficiario || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>
                  <p className="font-medium">{formatCurrency(ocrData.valor)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">
                    {ocrData.data ? format(new Date(ocrData.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium capitalize">{ocrData.tipo}</p>
                </div>
                {ocrData.identificador && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Identificador:</span>
                    <p className="font-medium text-xs break-all">{ocrData.identificador}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matched payable */}
        {matchedPayable ? (
          <Card className="mb-6 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  Despesa Encontrada ({matchedPayable.confidence}% confiança)
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Beneficiário:</span>
                  <p className="font-medium">{matchedPayable.payable.beneficiario || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>
                  <p className="font-medium">{formatCurrency(matchedPayable.payable.valor)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Vencimento:</span>
                  <p className="font-medium">
                    {matchedPayable.payable.vencimento 
                      ? format(new Date(matchedPayable.payable.vencimento + 'T12:00:00'), 'dd/MM/yyyy') 
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium capitalize">{matchedPayable.payable.status}</p>
                </div>
              </div>

              {/* Paid amount input */}
              <div className="mt-4 pt-4 border-t">
                <Label htmlFor="paid-amount">Valor Pago</Label>
                <Input
                  id="paid-amount"
                  type="number"
                  step="0.01"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || null)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {pendingPayables.length === 0 ? (
                <span>Não há despesas pendentes cadastradas. Você pode criar uma nova despesa e marcá-la como paga.</span>
              ) : (
                <span>
                  Nenhuma despesa pendente corresponde a esse comprovante (de {pendingPayables.length} disponíveis).
                  {possibleMatches.length > 0 && <span> Veja as sugestões abaixo.</span>}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Manual value input when no match and no OCR value */}
        {!matchedPayable && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Dados do Pagamento</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="manual-value">Valor Pago *</Label>
                  <Input
                    id="manual-value"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || null)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other possible matches */}
        {possibleMatches.length > 1 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Outras Possíveis Despesas</h3>
            <div className="space-y-2">
              {possibleMatches.slice(1, 5).map((match) => (
                <Card 
                  key={match.payable.id}
                  className="cursor-pointer hover:border-primary transition-all"
                  onClick={() => handleSelectPayable(match)}
                >
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{match.payable.beneficiario}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(match.payable.valor)} - {match.payable.vencimento ? format(new Date(match.payable.vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {match.confidence}%
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {canConfirmExisting && (
            <Button 
              onClick={handleConfirmPayment}
              disabled={isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          )}
          
          {!matchedPayable && canCreateNew && (
            <Button 
              onClick={handleCreateAndPay}
              disabled={isProcessing || !paidAmount}
              size="lg"
              className="w-full"
              variant={matchedPayable ? 'outline' : 'default'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Despesa e Marcar como Paga
                </>
              )}
            </Button>
          )}
          
          <Button variant="outline" onClick={handleReset} className="w-full">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Step: Success
  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Pagamento Registrado!</h2>
        <p className="text-muted-foreground mb-8">
          A despesa foi marcada como paga com sucesso.
        </p>

        <Card className="mb-8 text-left">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Beneficiário:</span>
                <p className="font-medium">
                  {matchedPayable?.payable.beneficiario || ocrData?.beneficiario || 'Não identificado'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Pago:</span>
                <p className="font-medium">{formatCurrency(paidAmount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Método:</span>
                <p className="font-medium capitalize">{paymentType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data:</span>
                <p className="font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Voltar ao Início
          </Button>
          <Button onClick={handleReset} className="flex-1">
            Registrar Outro
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
