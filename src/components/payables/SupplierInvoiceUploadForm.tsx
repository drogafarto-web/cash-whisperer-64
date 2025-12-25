import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Upload, FileText, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';

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

import { useSupplierInvoiceOcr } from '@/features/payables/hooks/usePayableOcr';
import { useCreateSupplierInvoice } from '@/features/payables/hooks/useSupplierInvoices';
import { useCreatePayablesFromParcelas } from '@/features/payables/hooks/usePayables';
import { checkDuplicateSupplierInvoice } from '@/features/payables/api/supplier-invoices.api';
import { SupplierInvoiceFormData, Parcela } from '@/types/payables';
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

  const { processFile, isProcessing } = useSupplierInvoiceOcr();
  const createInvoice = useCreateSupplierInvoice();
  const createParcelas = useCreatePayablesFromParcelas();

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
    },
  });

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
        toast({
          variant: 'destructive',
          title: 'Nota fiscal duplicada',
          description: 'Já existe uma nota fiscal com este número, fornecedor e data de emissão.',
        });
        return;
      }

      // Criar nota fiscal
      const invoice = await createInvoice.mutateAsync({
        data: {
          ...data,
          installments_count: parcelas.length || undefined,
        },
        ocrConfidence: ocrConfidence ?? undefined,
      });

      // Criar parcelas/boletos se houver
      if (parcelas.length > 0) {
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
                render={({ field }) => (
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
                    <FormMessage />
                  </FormItem>
                )}
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

          {/* Parcelas Section */}
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
