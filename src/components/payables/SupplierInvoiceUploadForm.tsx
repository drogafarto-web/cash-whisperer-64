import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Upload, FileText, Loader2, Plus, Trash2, Wand2, CreditCard, Banknote, Building2, Wallet, Clock, Check, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { useSupplierInvoiceOcr } from '@/features/payables/hooks/usePayableOcr';
import { useCreateSupplierInvoice } from '@/features/payables/hooks/useSupplierInvoices';
import { useCreatePayablesFromParcelas } from '@/features/payables/hooks/usePayables';
import { checkDuplicateSupplierInvoice } from '@/features/payables/api/supplier-invoices.api';
import { SupplierInvoiceFormData, Parcela, PaymentMethod, PAYMENT_METHOD_LABELS } from '@/types/payables';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { toast } from 'sonner';

const formSchema = z.object({
  document_number: z.string().min(1, 'Número do documento é obrigatório'),
  document_series: z.string().optional(),
  supplier_name: z.string().min(1, 'Nome do fornecedor é obrigatório'),
  supplier_cnpj: z.string().optional(),
  issue_date: z.string().min(1, 'Data de emissão é obrigatória'),
  due_date: z.string().optional(),
  total_value: z.number().min(0.01, 'Valor deve ser maior que zero'),
  description: z.string().optional(),
  payment_conditions: z.string().optional(),
  unit_id: z.string().optional(),
  category_id: z.string().optional(),
  payment_method: z.enum(['boleto', 'pix', 'transferencia', 'dinheiro']),
  payment_pix_key: z.string().optional(),
  payment_bank_account_id: z.string().optional(),
}).refine((data) => {
  // PIX requires pix key
  if (data.payment_method === 'pix' && !data.payment_pix_key) {
    return false;
  }
  return true;
}, {
  message: 'Chave PIX é obrigatória para pagamento via PIX',
  path: ['payment_pix_key'],
}).refine((data) => {
  // Transferencia requires bank account
  if (data.payment_method === 'transferencia' && !data.payment_bank_account_id) {
    return false;
  }
  return true;
}, {
  message: 'Conta bancária é obrigatória para transferência',
  path: ['payment_bank_account_id'],
});

interface Props {
  units: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SupplierInvoiceUploadForm({ units, categories, onSuccess, onCancel }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [boletoArrivalStatus, setBoletoArrivalStatus] = useState<'has_boleto' | 'waiting_boleto'>('has_boleto');

  const { processFile, isProcessing } = useSupplierInvoiceOcr();
  const createInvoice = useCreateSupplierInvoice();
  const createParcelas = useCreatePayablesFromParcelas();
  const { data: bankAccounts = [] } = useBankAccounts();

  const form = useForm<SupplierInvoiceFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      document_number: '',
      document_series: '',
      supplier_name: '',
      supplier_cnpj: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: '',
      total_value: 0,
      description: '',
      payment_conditions: '',
      unit_id: '',
      category_id: '',
      payment_method: 'boleto',
      payment_pix_key: '',
      payment_bank_account_id: '',
    },
  });

  const paymentMethod = form.watch('payment_method');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
  };

  const handleOcr = async () => {
    if (!selectedFile) return;

    try {
      const result = await processFile(selectedFile);

      // Preencher formulário com dados extraídos
      if (result.document_number) form.setValue('document_number', result.document_number);
      if (result.document_series) form.setValue('document_series', result.document_series);
      if (result.supplier_name) form.setValue('supplier_name', result.supplier_name);
      if (result.supplier_cnpj) form.setValue('supplier_cnpj', result.supplier_cnpj);
      if (result.issue_date) form.setValue('issue_date', result.issue_date);
      if (result.total_value) form.setValue('total_value', result.total_value);
      if (result.description) form.setValue('description', result.description);
      if (result.payment_conditions) form.setValue('payment_conditions', result.payment_conditions);

      // Preencher parcelas se houver
      if (result.parcelas && result.parcelas.length > 0) {
        setParcelas(result.parcelas);
        // Se só há uma parcela, usar seu vencimento como due_date
        if (result.parcelas.length === 1) {
          form.setValue('due_date', result.parcelas[0].vencimento);
        }
      }

      setOcrConfidence(result.confidence);
    } catch (error) {
      console.error('OCR error:', error);
    }
  };

  const addParcela = () => {
    const nextNum = parcelas.length + 1;
    const totalValue = form.getValues('total_value') || 0;
    const valorParcela = parcelas.length === 0 ? totalValue : totalValue / (parcelas.length + 1);

    setParcelas([
      ...parcelas,
      {
        numero: nextNum,
        valor: Math.round(valorParcela * 100) / 100,
        vencimento: format(new Date(), 'yyyy-MM-dd'),
      },
    ]);
  };

  const removeParcela = (index: number) => {
    const updated = parcelas.filter((_, i) => i !== index).map((p, i) => ({ ...p, numero: i + 1 }));
    setParcelas(updated);
  };

  const updateParcela = (index: number, field: keyof Parcela, value: string | number) => {
    const updated = [...parcelas];
    updated[index] = { ...updated[index], [field]: value };
    setParcelas(updated);
  };

  const onSubmit = async (data: SupplierInvoiceFormData) => {
    try {
      // Validar duplicata antes de salvar
      const isDuplicate = await checkDuplicateSupplierInvoice(
        data.document_number,
        data.supplier_cnpj,
        data.issue_date
      );

      if (isDuplicate) {
        toast.error('Nota fiscal duplicada', {
          description: 'Já existe uma nota fiscal com este número, fornecedor e data de emissão.',
        });
        return;
      }

      // Determine status based on payment method and boleto arrival
      const isWaitingBoleto = paymentMethod === 'boleto' && boletoArrivalStatus === 'waiting_boleto';
      const status = isWaitingBoleto ? 'aguardando_boleto' : 'pendente';

      // Criar nota fiscal
      const invoice = await createInvoice.mutateAsync({
        data: {
          ...data,
          installments_count: isWaitingBoleto ? undefined : (parcelas.length || undefined),
        },
        ocrConfidence: ocrConfidence ?? undefined,
        status,
      });

      // Criar parcelas/boletos se houver (and not waiting for boleto)
      if (parcelas.length > 0 && !isWaitingBoleto) {
        await createParcelas.mutateAsync({
          parcelas,
          supplierInvoice: {
            id: invoice.id,
            supplier_name: invoice.supplier_name,
            supplier_cnpj: invoice.supplier_cnpj,
            unit_id: invoice.unit_id,
            category_id: invoice.category_id,
          },
        });
      }

      if (isWaitingBoleto) {
        toast.success('NF cadastrada - Aguardando boleto', {
          description: 'Quando o boleto chegar, cadastre-o em "Boletos" e vincule a esta NF.',
        });
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload da Nota Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Arquivo
              </Button>
              {selectedFile && (
                <>
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleOcr}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Extrair Dados (OCR)
                  </Button>
                </>
              )}
            </div>
            {ocrConfidence !== null && (
              <Badge variant={ocrConfidence > 70 ? 'default' : 'secondary'}>
                Confiança OCR: {ocrConfidence}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Section */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Nota Fiscal</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Documento *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123456" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_series"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Série</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do fornecedor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00.000.000/0000-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Emissão *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => {
                  const selectedCat = categories.find(c => c.id === field.value) as any;
                  const entraFatorR = selectedCat?.entra_fator_r || selectedCat?.tax_group === 'PESSOAL';
                  
                  return (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {entraFatorR && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="secondary" className="text-xs gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Entra no cálculo do Fator R
                          </Badge>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="payment_conditions"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Condições de Pagamento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: 30/60/90 dias" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descrição dos itens/serviços..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Payment Method Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Forma de Pagamento *
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                      >
                        <div>
                          <RadioGroupItem
                            value="boleto"
                            id="payment-boleto"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="payment-boleto"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <CreditCard className="h-6 w-6 mb-2" />
                            <span className="text-sm font-medium">Boleto</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="pix"
                            id="payment-pix"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="payment-pix"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <Banknote className="h-6 w-6 mb-2" />
                            <span className="text-sm font-medium">PIX</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="transferencia"
                            id="payment-transferencia"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="payment-transferencia"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <Building2 className="h-6 w-6 mb-2" />
                            <span className="text-sm font-medium">Transferência</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="dinheiro"
                            id="payment-dinheiro"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="payment-dinheiro"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <Wallet className="h-6 w-6 mb-2" />
                            <span className="text-sm font-medium">Dinheiro</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional fields based on payment method */}
              {paymentMethod === 'pix' && (
                <FormField
                  control={form.control}
                  name="payment_pix_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave PIX do Fornecedor *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {paymentMethod === 'transferencia' && (
                <FormField
                  control={form.control}
                  name="payment_bank_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta Bancária de Destino *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a conta..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} {acc.institution ? `- ${acc.institution}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Boleto Arrival Status - Only show for boleto */}
          {paymentMethod === 'boleto' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Situação do Boleto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={boletoArrivalStatus}
                  onValueChange={(v) => setBoletoArrivalStatus(v as 'has_boleto' | 'waiting_boleto')}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="has_boleto"
                      id="boleto-has"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="boleto-has"
                      className="flex items-center gap-3 rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Check className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Já tenho o boleto</p>
                        <p className="text-sm text-muted-foreground">Posso cadastrar as parcelas agora</p>
                      </div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="waiting_boleto"
                      id="boleto-waiting"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="boleto-waiting"
                      className="flex items-center gap-3 rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Clock className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium">Boleto ainda não chegou</p>
                        <p className="text-sm text-muted-foreground">Cadastrarei o boleto depois</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {boletoArrivalStatus === 'waiting_boleto' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      A NF será salva com status <strong>"Aguardando Boleto"</strong>. 
                      Quando o boleto físico/digital chegar, cadastre-o em <strong>Contas a Pagar → Boletos</strong> e o sistema sugerirá automaticamente esta NF para vinculação.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Parcelas Section - Only show for boleto when user has the boleto */}
          {paymentMethod === 'boleto' && boletoArrivalStatus === 'has_boleto' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Parcelas / Boletos ({parcelas.length})</span>
                  <Button type="button" variant="outline" size="sm" onClick={addParcela}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Parcela
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {parcelas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma parcela adicionada. Clique em "Adicionar Parcela" ou use o OCR para extrair automaticamente.
                  </p>
                ) : (
                <div className="space-y-4">
                  {parcelas.map((parcela, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg"
                    >
                      <div>
                        <Label>Parcela</Label>
                        <Input
                          value={`${parcela.numero}/${parcelas.length}`}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={parcela.valor}
                          onChange={(e) =>
                            updateParcela(index, 'valor', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label>Vencimento</Label>
                        <Input
                          type="date"
                          value={parcela.vencimento}
                          onChange={(e) => updateParcela(index, 'vencimento', e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParcela(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          )}
          {/* Actions */}
          <div className="flex justify-end gap-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={createInvoice.isPending || createParcelas.isPending}
            >
              {(createInvoice.isPending || createParcelas.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar Nota Fiscal
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
