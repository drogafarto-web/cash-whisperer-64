import { useState, useRef } from 'react';
import { ExternalLink, Upload, Zap, Loader2, Check, AlertCircle, Receipt, Banknote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBoletoOcr } from '@/hooks/useBoletoOcr';
import { formatCurrency } from '@/lib/formats';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logFiscalControlAccess } from '@/services/cashAuditService';

interface QuickOpsTabProps {
  userId: string;
}

export function QuickOpsTab({ userId }: QuickOpsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [creatingPayable, setCreatingPayable] = useState(false);
  
  const { analyze, isLoading, result, error, reset } = useBoletoOcr();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }
    await analyze(selectedFile);
  };

  const handleCreatePayable = async () => {
    if (!result || !result.valor) {
      toast.error('Dados insuficientes para criar conta a pagar');
      return;
    }

    setCreatingPayable(true);
    try {
      const { error: insertError } = await supabase.from('payables').insert({
        description: result.beneficiario || 'Boleto importado via OCR',
        valor: result.valor,
        vencimento: result.vencimento || new Date().toISOString().split('T')[0],
        status: 'pending',
        codigo_barras: result.codigo_barras,
        linha_digitavel: result.linha_digitavel,
      });

      if (insertError) throw insertError;

      // Log da criação
      await logFiscalControlAccess({
        userId,
        action: 'created',
        amount: result.valor,
      });

      toast.success('Conta a pagar criada com sucesso!');
      reset();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erro ao criar payable:', err);
      toast.error('Erro ao criar conta a pagar');
    } finally {
      setCreatingPayable(false);
    }
  };

  const openKiosk = (path: string) => {
    window.open(path, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Card: Links Rápidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Links Rápidos - Quiosques
          </CardTitle>
          <CardDescription>
            Acesso direto aos painéis de quiosque em nova aba
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => openKiosk('/core/reception-panel?mode=kiosk')}
            >
              <Receipt className="h-4 w-4" />
              Quiosque Recepção
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => openKiosk('/accounting-panel?mode=kiosk')}
            >
              <Banknote className="h-4 w-4" />
              Quiosque Contabilidade
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card: Análise de Boleto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Analisar Boleto (OCR + IA)
          </CardTitle>
          <CardDescription>
            Faça upload de uma imagem de boleto para extrair dados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload */}
          <div className="space-y-2">
            <Label htmlFor="boleto-file">Imagem do Boleto</Label>
            <Input
              ref={fileInputRef}
              id="boleto-file"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={!selectedFile || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Analisar Boleto
              </>
            )}
          </Button>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Resultado OCR */}
          {result && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Dados Extraídos</h4>
                <Badge variant={result.confidence >= 80 ? 'default' : 'secondary'}>
                  {result.confidence}% confiança
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {result.beneficiario && (
                  <div>
                    <span className="text-muted-foreground">Beneficiário:</span>
                    <p className="font-medium">{result.beneficiario}</p>
                  </div>
                )}
                {result.beneficiario_cnpj && (
                  <div>
                    <span className="text-muted-foreground">CNPJ:</span>
                    <p className="font-medium">{result.beneficiario_cnpj}</p>
                  </div>
                )}
                {result.valor && (
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <p className="font-medium text-primary">{formatCurrency(result.valor)}</p>
                  </div>
                )}
                {result.vencimento && (
                  <div>
                    <span className="text-muted-foreground">Vencimento:</span>
                    <p className="font-medium">
                      {format(new Date(result.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
                {result.banco_nome && (
                  <div>
                    <span className="text-muted-foreground">Banco:</span>
                    <p className="font-medium">{result.banco_nome} ({result.banco_codigo})</p>
                  </div>
                )}
                {result.linha_digitavel && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Linha Digitável:</span>
                    <p className="font-mono text-xs break-all">{result.linha_digitavel}</p>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleCreatePayable} 
                  disabled={creatingPayable || !result.valor}
                  className="flex-1"
                >
                  {creatingPayable ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Criar Conta a Pagar
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { reset(); setSelectedFile(null); }}>
                  Limpar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
