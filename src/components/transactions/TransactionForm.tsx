import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UnitSelector } from '@/components/UnitSelector';
import { supabase } from '@/integrations/supabase/client';
import { Account, Category, OcrData, TransactionType, PaymentMethod, Unit, Partner } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  Upload, 
  Check, 
  Sparkles,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { User } from '@supabase/supabase-js';

export interface TransactionFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  units: Unit[];
  accounts: Account[];
  categories: Category[];
  partners: Partner[];
  isAdmin: boolean;
  userUnit: Unit | null;
  user: User;
}

export function TransactionForm({
  isOpen,
  onOpenChange,
  onSuccess,
  units,
  accounts,
  categories,
  partners,
  isAdmin,
  userUnit,
  user,
}: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    type: 'SAIDA' as TransactionType,
    payment_method: 'PIX' as PaymentMethod,
    account_id: '',
    category_id: '',
    partner_id: '',
    description: '',
    unit_id: !isAdmin && userUnit ? userUnit.id : '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [valueWarning, setValueWarning] = useState<{
    expected: number;
    actual: number;
    difference: number;
  } | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    if (selectedFile.type.startsWith('image/')) {
      setIsProcessingOcr(true);
      try {
        const base64 = await fileToBase64(selectedFile);
        
        const response = await supabase.functions.invoke('ocr-receipt', {
          body: { imageBase64: base64, mimeType: selectedFile.type }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const { ocrData: extractedData } = response.data;
        setOcrData(extractedData);

        if (extractedData && !extractedData.error) {
          if (extractedData.valor) {
            setFormData(prev => ({ ...prev, amount: String(extractedData.valor) }));
          }
          if (extractedData.data) {
            setFormData(prev => ({ ...prev, date: extractedData.data }));
          }
          if (extractedData.descricao) {
            setFormData(prev => ({ ...prev, description: extractedData.descricao }));
          }
          toast.success(`OCR processado com ${extractedData.confianca || 0}% de confiança`);
        }
      } catch (error) {
        console.error('OCR error:', error);
        toast.error('Erro ao processar comprovante com OCR');
      } finally {
        setIsProcessingOcr(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.account_id || !formData.category_id) {
      toast.error('Selecione conta e categoria');
      return;
    }

    if (!formData.unit_id) {
      toast.error('Selecione a unidade');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          ...formData,
          partner_id: formData.partner_id || null,
          amount: parseFloat(formData.amount),
          created_by: user.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      if (file && txData) {
        const fileName = `${txData.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (!uploadError) {
          await supabase.from('documents').insert([{
            transaction_id: txData.id,
            file_path: fileName,
            file_name: file.name,
            file_type: file.type,
            ocr_data: ocrData as any,
          }]);
        }
      }

      toast.success('Transação criada com sucesso!');
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Erro ao criar transação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      type: 'SAIDA',
      payment_method: 'PIX',
      account_id: '',
      category_id: '',
      partner_id: '',
      description: '',
      unit_id: !isAdmin && userUnit ? userUnit.id : '',
    });
    setFile(null);
    setOcrData(null);
    setValueWarning(null);
  };

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId);
    setFormData(prev => ({
      ...prev,
      partner_id: partnerId,
      category_id: partner?.default_category_id || prev.category_id,
    }));
    
    if (partner?.expected_amount && formData.amount) {
      const currentAmount = parseFloat(formData.amount);
      if (!isNaN(currentAmount) && Math.abs(currentAmount - partner.expected_amount) > 0.01) {
        setValueWarning({
          expected: partner.expected_amount,
          actual: currentAmount,
          difference: currentAmount - partner.expected_amount,
        });
      } else {
        setValueWarning(null);
      }
    } else {
      setValueWarning(null);
    }
  };

  const handleAmountChange = (value: string) => {
    setFormData(prev => ({ ...prev, amount: value }));
    
    const partner = partners.find(p => p.id === formData.partner_id);
    if (partner?.expected_amount) {
      const amount = parseFloat(value);
      if (!isNaN(amount) && Math.abs(amount - partner.expected_amount) > 0.01) {
        setValueWarning({
          expected: partner.expected_amount,
          actual: amount,
          difference: amount - partner.expected_amount,
        });
      } else {
        setValueWarning(null);
      }
    }
  };

  const handleTypeChange = (type: TransactionType) => {
    setFormData(prev => ({ 
      ...prev, 
      type, 
      category_id: '', 
      partner_id: '' 
    }));
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);
  
  const filteredPartners = partners.filter(p => 
    (formData.type === 'ENTRADA' && p.type === 'CLIENTE') ||
    (formData.type === 'SAIDA' && p.type === 'FORNECEDOR')
  );
  
  const filteredAccounts = formData.unit_id 
    ? accounts.filter(a => a.unit_id === formData.unit_id)
    : accounts;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="shadow-md">
          <Plus className="w-5 h-5 mr-2" />
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Unit selector */}
          <div className="space-y-2">
            <Label>Unidade</Label>
            {isAdmin ? (
              <UnitSelector
                value={formData.unit_id}
                onChange={value => setFormData(prev => ({ ...prev, unit_id: value, account_id: '' }))}
                placeholder="Selecione a unidade..."
              />
            ) : (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm font-medium">{userUnit?.name || 'Sem unidade'}</span>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Comprovante (opcional)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={isProcessingOcr}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {isProcessingOcr ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span>Processando OCR...</span>
                  </div>
                ) : file ? (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Check className="w-5 h-5" />
                    <span>{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="w-8 h-8" />
                    <span>Clique para enviar comprovante</span>
                    <span className="text-xs">Imagens serão processadas com OCR</span>
                  </div>
                )}
              </label>
            </div>
            {ocrData && !ocrData.error && (
              <p className="text-xs text-success flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Dados extraídos automaticamente via OCR
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.amount}
                onChange={e => handleAmountChange(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Value divergence warning */}
          {valueWarning && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div>
                <span className="font-medium">Valor diferente do esperado!</span>
                <div className="text-xs text-muted-foreground">
                  Esperado: R$ {valueWarning.expected.toFixed(2)} | 
                  Informado: R$ {valueWarning.actual.toFixed(2)} | 
                  Diferença: {valueWarning.difference > 0 ? '+' : ''}R$ {valueWarning.difference.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={value => handleTypeChange(value as TransactionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.payment_method}
                onValueChange={value => setFormData(prev => ({ ...prev, payment_method: value as PaymentMethod }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parceiro selector */}
          <div className="space-y-2">
            <Label>Parceiro (opcional)</Label>
            <Select
              value={formData.partner_id || 'none'}
              onValueChange={(value) => handlePartnerChange(value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {filteredPartners.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.is_recurring && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select
                value={formData.account_id}
                onValueChange={value => setFormData(prev => ({ ...prev, account_id: value }))}
                disabled={!formData.unit_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.unit_id ? "Selecione unidade primeiro" : "Selecione..."} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.category_id}
                onValueChange={value => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Detalhes da transação..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Transação
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
