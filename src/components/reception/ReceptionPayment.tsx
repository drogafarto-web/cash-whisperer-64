import { useState, useRef } from 'react';
import { ArrowLeft, CreditCard, Smartphone, Upload, Loader2, CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePayables, useMarkPayableAsPaid } from '@/features/payables/hooks/usePayables';
import { ocrBoleto, fileToBase64 } from '@/features/payables/api/ocr.api';
import { BoletoOcrResult, Payable } from '@/types/payables';
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
  const [ocrData, setOcrData] = useState<BoletoOcrResult | null>(null);
  const [matchedPayable, setMatchedPayable] = useState<MatchResult | null>(null);
  const [possibleMatches, setPossibleMatches] = useState<MatchResult[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: pendingPayables = [] } = usePayables({ 
    status: 'pendente',
    unitId: unitId || undefined 
  });
  const markAsPaid = useMarkPayableAsPaid();

  const findMatches = (ocrResult: BoletoOcrResult): MatchResult[] => {
    const matches: MatchResult[] = [];

    for (const payable of pendingPayables) {
      // Match by linha digitavel (exact)
      if (ocrResult.linha_digitavel && payable.linha_digitavel) {
        const ocrLinha = ocrResult.linha_digitavel.replace(/[\s.]/g, '');
        const payableLinha = payable.linha_digitavel.replace(/[\s.]/g, '');
        if (ocrLinha === payableLinha) {
          matches.push({ payable, confidence: 100, matchType: 'linha_digitavel' });
          continue;
        }
      }

      // Match by value + due date
      if (ocrResult.valor && ocrResult.vencimento) {
        const valueDiff = Math.abs((payable.valor || 0) - ocrResult.valor);
        const valueMatch = valueDiff < 0.01; // Exact value match
        const dateMatch = payable.vencimento === ocrResult.vencimento;
        
        if (valueMatch && dateMatch) {
          matches.push({ payable, confidence: 95, matchType: 'valor_data' });
          continue;
        }
        
        // Close value match (within 1% )
        if (valueDiff / ocrResult.valor < 0.01 && dateMatch) {
          matches.push({ payable, confidence: 85, matchType: 'valor_data' });
          continue;
        }
      }

      // Match by beneficiary name
      if (ocrResult.beneficiario && payable.beneficiario) {
        const ocrBenef = ocrResult.beneficiario.toLowerCase().trim();
        const payableBenef = payable.beneficiario.toLowerCase().trim();
        
        if (ocrBenef.includes(payableBenef) || payableBenef.includes(ocrBenef)) {
          // Check if value is close (within 5%)
          if (ocrResult.valor && payable.valor) {
            const valueDiff = Math.abs((payable.valor || 0) - ocrResult.valor);
            if (valueDiff / ocrResult.valor < 0.05) {
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
    
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await ocrBoleto(base64, mimeType);
      
      setOcrData(result);
      setPaidAmount(result.valor || null);
      
      // Find matches
      const matches = findMatches(result);
      setPossibleMatches(matches);
      
      if (matches.length > 0 && matches[0].confidence >= 80) {
        setMatchedPayable(matches[0]);
      }
      
      setStep('review');
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Erro ao processar comprovante', {
        description: 'Tente novamente ou insira os dados manualmente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCodeSearch = async () => {
    if (!manualCode.trim()) return;
    
    setIsProcessing(true);
    const cleanCode = manualCode.replace(/[\s.]/g, '');
    
    // Search in pending payables by linha_digitavel
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
        linha_digitavel: manualCode,
        codigo_barras: null,
        banco_codigo: null,
        banco_nome: null,
        beneficiario: matches[0].beneficiario,
        beneficiario_cnpj: matches[0].beneficiario_cnpj,
        valor: matches[0].valor,
        vencimento: matches[0].vencimento,
        confidence: 100,
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
      await markAsPaid.mutateAsync({
        id: matchedPayable.payable.id,
        paidAmount: paidAmount || matchedPayable.payable.valor || 0,
        paidMethod: paymentType === 'pix' ? 'pix' : 'boleto',
      });
      
      setStep('success');
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao registrar pagamento');
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
    setMatchedPayable(null);
    setPossibleMatches([]);
    setManualCode('');
    setPaidAmount(null);
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
        <p className="text-muted-foreground text-center mb-8">
          Tire uma foto ou selecione o arquivo do comprovante
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
    return (
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" onClick={() => setStep('upload')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <h2 className="text-2xl font-bold text-center mb-6">Revisar Pagamento</h2>

        {/* OCR extracted data */}
        {ocrData && (
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
                  <span className="text-muted-foreground">Vencimento:</span>
                  <p className="font-medium">
                    {ocrData.vencimento ? format(new Date(ocrData.vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Banco:</span>
                  <p className="font-medium">{ocrData.banco_nome || ocrData.banco_codigo || '-'}</p>
                </div>
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
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma despesa pendente encontrada para esse comprovante.
              {possibleMatches.length > 0 && (
                <span> Veja as sugestões abaixo.</span>
              )}
            </AlertDescription>
          </Alert>
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
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmPayment}
            disabled={!matchedPayable || isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Confirmar Pagamento'
            )}
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

        {matchedPayable && (
          <Card className="mb-8 text-left">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Beneficiário:</span>
                  <p className="font-medium">{matchedPayable.payable.beneficiario}</p>
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
        )}

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
