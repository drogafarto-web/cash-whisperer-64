import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Check, FileText, CreditCard, QrCode, Barcode, Calendar, Building2 } from 'lucide-react';
import { TaxDocumentOcrResult, TAX_DOCUMENT_LABELS, TaxDocumentType } from '@/types/payables';
import { supabase } from '@/integrations/supabase/client';

interface TaxDocumentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  ocrResult: TaxDocumentOcrResult | null;
  file: File | null;
  filePath: string | null;
  unitId?: string;
  onConfirm: (createPayable: boolean, data: ConfirmData) => Promise<void>;
}

export interface ConfirmData {
  tipo_documento: TaxDocumentType;
  valor: number;
  vencimento: string;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  pix_key: string | null;
  pix_tipo: string | null;
  beneficiario: string | null;
  cnpj: string | null;
  competencia: { ano: number; mes: number } | null;
  categoryId: string | null;
  unitId: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  name: string;
}

export function TaxDocumentConfirmModal({
  isOpen,
  onClose,
  ocrResult,
  file,
  filePath,
  unitId,
  onConfirm,
}: TaxDocumentConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createPayable, setCreatePayable] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Editable fields
  const [tipoDocumento, setTipoDocumento] = useState<TaxDocumentType>('outro');
  const [valor, setValor] = useState<number>(0);
  const [vencimento, setVencimento] = useState<string>('');
  const [codigoBarras, setCodigoBarras] = useState<string>('');
  const [linhaDigitavel, setLinhaDigitavel] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  const [beneficiario, setBeneficiario] = useState<string>('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(unitId || '');

  // Load categories and units
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('type', 'SAIDA')
        .eq('active', true)
        .order('name');
      if (data) setCategories(data as any);
    };
    
    const loadUnits = async () => {
      const result = await supabase.from('units').select('id, name').eq('active', true);
      if (result.data) setUnits(result.data as any);
    };
    
    loadCategories();
    loadUnits();
  }, []);

  // Populate fields when OCR result changes
  useEffect(() => {
    if (ocrResult) {
      setTipoDocumento(ocrResult.tipo_documento);
      setValor(ocrResult.valor || 0);
      setVencimento(ocrResult.vencimento || '');
      setCodigoBarras(ocrResult.codigo_barras || '');
      setLinhaDigitavel(ocrResult.linha_digitavel || '');
      setPixKey(ocrResult.pix_key || '');
      setBeneficiario(ocrResult.beneficiario || '');
      
      // Try to auto-select category based on document type
      const categoryMatch = categories.find(c => 
        c.name.toLowerCase().includes('imposto') || 
        c.name.toLowerCase().includes('tributo') ||
        c.name.toLowerCase().includes('taxa')
      );
      if (categoryMatch) setSelectedCategoryId(categoryMatch.id);
    }
  }, [ocrResult, categories]);

  useEffect(() => {
    if (unitId) setSelectedUnitId(unitId);
  }, [unitId]);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copiado para a área de transferência!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleConfirm = async () => {
    if (!valor || valor <= 0) {
      toast.error('Informe o valor do documento');
      return;
    }
    if (!vencimento) {
      toast.error('Informe a data de vencimento');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(createPayable, {
        tipo_documento: tipoDocumento,
        valor,
        vencimento,
        codigo_barras: codigoBarras || null,
        linha_digitavel: linhaDigitavel || null,
        pix_key: pixKey || null,
        pix_tipo: ocrResult?.pix_tipo || null,
        beneficiario: beneficiario || null,
        cnpj: ocrResult?.cnpj || null,
        competencia: ocrResult?.competencia || null,
        categoryId: selectedCategoryId || null,
        unitId: selectedUnitId || null,
      });
      onClose();
    } catch (error) {
      console.error('Error confirming:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const confidence = ocrResult?.confidence || 0;
  const confidenceColor = confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documento Analisado
            <Badge variant="outline" className={`ml-2 ${confidenceColor} text-white`}>
              {Math.round(confidence * 100)}% confiança
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Type */}
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {TAX_DOCUMENT_LABELS[tipoDocumento]}
            </Badge>
            {file && (
              <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                {file.name}
              </span>
            )}
          </div>

          {/* Main Data Card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                    className="font-mono text-lg"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(valor)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="vencimento">Vencimento</Label>
                  <Input
                    id="vencimento"
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                  />
                  {vencimento && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(parseISO(vencimento), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="beneficiario">Beneficiário</Label>
                <Input
                  id="beneficiario"
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  placeholder="Nome do beneficiário"
                />
              </div>

              {ocrResult?.competencia && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Competência: {ocrResult.competencia.mes}/{ocrResult.competencia.ano}</span>
                </div>
              )}

              {ocrResult?.cnpj && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>CNPJ: {ocrResult.cnpj}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Data Card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Dados para Pagamento
              </h3>

              {/* Linha Digitável */}
              <div>
                <Label htmlFor="linha_digitavel" className="flex items-center gap-2">
                  <Barcode className="h-4 w-4" />
                  Linha Digitável
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="linha_digitavel"
                    value={linhaDigitavel}
                    onChange={(e) => setLinhaDigitavel(e.target.value)}
                    placeholder="Ex: 85890000012345678901234..."
                    className="font-mono text-sm"
                  />
                  {linhaDigitavel && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(linhaDigitavel, 'linha')}
                    >
                      {copiedField === 'linha' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Código de Barras */}
              <div>
                <Label htmlFor="codigo_barras" className="flex items-center gap-2">
                  <Barcode className="h-4 w-4" />
                  Código de Barras
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="codigo_barras"
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    placeholder="Ex: 85890000012345..."
                    className="font-mono text-sm"
                  />
                  {codigoBarras && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(codigoBarras, 'barras')}
                    >
                      {copiedField === 'barras' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* PIX */}
              <div>
                <Label htmlFor="pix_key" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Chave PIX
                  {ocrResult?.pix_tipo && (
                    <Badge variant="outline" className="text-xs">
                      {ocrResult.pix_tipo}
                    </Badge>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="pix_key"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="CPF, CNPJ, e-mail ou chave aleatória"
                    className="font-mono text-sm"
                  />
                  {pixKey && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(pixKey, 'pix')}
                    >
                      {copiedField === 'pix' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Create Payable Option */}
          <Card className="border-primary/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="create-payable"
                  checked={createPayable}
                  onCheckedChange={(checked) => setCreatePayable(checked === true)}
                />
                <Label htmlFor="create-payable" className="font-medium cursor-pointer">
                  Criar Conta a Pagar automaticamente
                </Label>
              </div>

              {createPayable && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
