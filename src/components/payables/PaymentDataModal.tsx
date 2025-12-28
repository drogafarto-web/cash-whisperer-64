import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, Sparkles, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { updatePayablePaymentData } from '@/features/payables/api/payables.api';
import { convertPdfToImage, blobToBase64 } from '@/utils/pdfToImage';

interface PaymentDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payableId: string;
  payableBeneficiario?: string;
  payableValor?: number;
}

interface BoletoOcrResult {
  linha_digitavel: string | null;
  codigo_barras: string | null;
  banco_codigo: string | null;
  banco_nome: string | null;
  beneficiario: string | null;
  beneficiario_cnpj: string | null;
  valor: number | null;
  vencimento: string | null;
  nosso_numero: string | null;
  documento: string | null;
  confianca: number;
}

export function PaymentDataModal({
  open,
  onOpenChange,
  payableId,
  payableBeneficiario,
  payableValor,
}: PaymentDataModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrResult, setOcrResult] = useState<BoletoOcrResult | null>(null);
  
  // Form fields
  const [vencimento, setVencimento] = useState('');
  const [linhaDigitavel, setLinhaDigitavel] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [bancoCodigo, setBancoCodigo] = useState('');
  const [bancoNome, setBancoNome] = useState('');

  const resetForm = useCallback(() => {
    setOcrResult(null);
    setVencimento('');
    setLinhaDigitavel('');
    setCodigoBarras('');
    setPixKey('');
    setBancoCodigo('');
    setBancoNome('');
    setActiveTab('upload');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    setIsProcessing(true);
    setOcrResult(null);

    try {
      toast.info('Processando boleto com IA...', { id: 'boleto-ocr', duration: 15000 });

      let imageBase64: string;
      let mimeType: string;

      // Convert PDF to image if needed
      if (file.type === 'application/pdf') {
        const imageBlob = await convertPdfToImage(file, 2);
        imageBase64 = await blobToBase64(imageBlob);
        mimeType = 'image/png';
      } else {
        // Read image directly
        const reader = new FileReader();
        const result = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        const [header, base64] = result.split(',');
        mimeType = header.match(/data:(.*);/)?.[1] || 'image/jpeg';
        imageBase64 = base64;
      }

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('ocr-boleto', {
        body: { imageBase64, mimeType },
      });

      toast.dismiss('boleto-ocr');

      if (error) throw error;
      
      const ocrData = data?.ocrData as BoletoOcrResult;
      
      if (!ocrData) {
        throw new Error('Não foi possível extrair dados do boleto');
      }

      setOcrResult(ocrData);
      
      // Fill form with OCR results
      if (ocrData.vencimento) setVencimento(ocrData.vencimento);
      if (ocrData.linha_digitavel) setLinhaDigitavel(ocrData.linha_digitavel);
      if (ocrData.codigo_barras) setCodigoBarras(ocrData.codigo_barras);
      if (ocrData.banco_codigo) setBancoCodigo(ocrData.banco_codigo);
      if (ocrData.banco_nome) setBancoNome(ocrData.banco_nome);

      toast.success('Boleto processado com sucesso!', {
        description: `Confiança: ${ocrData.confianca}%`,
      });

    } catch (error) {
      toast.dismiss('boleto-ocr');
      console.error('OCR error:', error);
      toast.error('Erro ao processar boleto', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  }, []);

  const handleSave = useCallback(async () => {
    // Validate that at least one field is filled
    if (!vencimento && !linhaDigitavel && !codigoBarras && !pixKey) {
      toast.error('Preencha ao menos um campo', {
        description: 'Informe vencimento, código de barras, linha digitável ou chave PIX',
      });
      return;
    }

    setIsSaving(true);

    try {
      await updatePayablePaymentData(payableId, {
        vencimento: vencimento || undefined,
        linha_digitavel: linhaDigitavel || undefined,
        codigo_barras: codigoBarras || undefined,
        pix_key: pixKey || undefined,
        banco_codigo: bancoCodigo || undefined,
        banco_nome: bancoNome || undefined,
      });

      toast.success('Dados de pagamento atualizados!');
      handleClose();
    } catch (error) {
      console.error('Error saving payment data:', error);
      toast.error('Erro ao salvar dados de pagamento');
    } finally {
      setIsSaving(false);
    }
  }, [payableId, vencimento, linhaDigitavel, codigoBarras, pixKey, bancoCodigo, bancoNome, handleClose]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Adicionar Dados de Pagamento
          </DialogTitle>
          <DialogDescription>
            Anexe um boleto ou informe os dados manualmente para facilitar o controle de pagamentos.
          </DialogDescription>
        </DialogHeader>

        {/* Context info */}
        {(payableBeneficiario || payableValor) && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              Despesa: <span className="font-medium text-foreground">{payableBeneficiario}</span>
            </p>
            {payableValor && (
              <p className="text-muted-foreground">
                Valor: <span className="font-medium text-foreground">{formatCurrency(payableValor)}</span>
              </p>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'manual')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Boleto
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="h-4 w-4" />
              Digitar Manualmente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            {/* Upload area */}
            <Card className="border-dashed">
              <CardContent className="p-6">
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={isProcessing}
                  />
                  <div className="p-4 rounded-full bg-muted mb-3">
                    {isProcessing ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    {isProcessing ? 'Processando boleto...' : 'Clique para enviar boleto'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG ou PNG • OCR automático
                  </p>
                </label>
              </CardContent>
            </Card>

            {/* OCR Result */}
            {ocrResult && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      Dados extraídos
                    </span>
                    <Badge variant="outline">
                      Confiança: {ocrResult.confianca}%
                    </Badge>
                  </div>
                  
                  <div className="grid gap-2 text-sm">
                    {ocrResult.vencimento && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vencimento:</span>
                        <span className="font-medium">
                          {new Date(ocrResult.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {ocrResult.valor && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor boleto:</span>
                        <span className="font-medium">{formatCurrency(ocrResult.valor)}</span>
                      </div>
                    )}
                    {ocrResult.banco_nome && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Banco:</span>
                        <span className="font-medium">{ocrResult.banco_nome}</span>
                      </div>
                    )}
                    {ocrResult.linha_digitavel && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Linha digitável:</span>
                        <span className="font-mono text-xs break-all">{ocrResult.linha_digitavel}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit extracted data */}
            {ocrResult && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Revise e ajuste se necessário:
                </p>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vencimento-ocr">Vencimento</Label>
                    <Input
                      id="vencimento-ocr"
                      type="date"
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="linha-ocr">Linha Digitável</Label>
                    <Input
                      id="linha-ocr"
                      value={linhaDigitavel}
                      onChange={(e) => setLinhaDigitavel(e.target.value)}
                      placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vencimento-manual">Data de Vencimento</Label>
                <Input
                  id="vencimento-manual"
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="linha-manual">Linha Digitável (Boleto)</Label>
                <Input
                  id="linha-manual"
                  value={linhaDigitavel}
                  onChange={(e) => setLinhaDigitavel(e.target.value)}
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="codigo-barras">Código de Barras</Label>
                <Input
                  id="codigo-barras"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="44 dígitos do código de barras"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pix-key">Chave PIX</Label>
                <Input
                  id="pix-key"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="banco-codigo">Código Banco</Label>
                  <Input
                    id="banco-codigo"
                    value={bancoCodigo}
                    onChange={(e) => setBancoCodigo(e.target.value)}
                    placeholder="Ex: 341"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="banco-nome">Nome Banco</Label>
                  <Input
                    id="banco-nome"
                    value={bancoNome}
                    onChange={(e) => setBancoNome(e.target.value)}
                    placeholder="Ex: Itaú"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Pular por agora
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isProcessing}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
