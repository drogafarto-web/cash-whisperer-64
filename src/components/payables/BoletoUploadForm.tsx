import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Upload, Barcode, Loader2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { useBoletoOcr } from '@/features/payables/hooks/usePayableOcr';
import { useCreatePayable } from '@/features/payables/hooks/usePayables';
import { 
  checkDuplicatePayableByCodigoBarras, 
  checkDuplicatePayableByLinhaDigitavel 
} from '@/features/payables/api/payables.api';
import { PayableFormData, SupplierInvoice } from '@/types/payables';
import { toast } from 'sonner';

const formSchema = z.object({
  beneficiario: z.string().min(1, 'Beneficiário é obrigatório'),
  beneficiario_cnpj: z.string().optional(),
  valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
  vencimento: z.string().min(1, 'Vencimento é obrigatório'),
  linha_digitavel: z.string().optional(),
  codigo_barras: z.string().optional(),
  banco_codigo: z.string().optional(),
  banco_nome: z.string().optional(),
  description: z.string().optional(),
  parcela_numero: z.number().optional(),
  parcela_total: z.number().optional(),
  supplier_invoice_id: z.string().optional(),
  unit_id: z.string().optional(),
  category_id: z.string().optional(),
});

interface Props {
  units: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  supplierInvoices?: Array<{ id: string; document_number: string; supplier_name: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BoletoUploadForm({
  units,
  categories,
  supplierInvoices = [],
  onSuccess,
  onCancel,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

  const { processFile, isProcessing } = useBoletoOcr();
  const createPayable = useCreatePayable();

  const form = useForm<PayableFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beneficiario: '',
      beneficiario_cnpj: '',
      valor: 0,
      vencimento: format(new Date(), 'yyyy-MM-dd'),
      linha_digitavel: '',
      codigo_barras: '',
      banco_codigo: '',
      banco_nome: '',
      description: '',
      tipo: 'boleto',
      parcela_numero: undefined,
      parcela_total: undefined,
      supplier_invoice_id: '',
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
      if (result.beneficiario) form.setValue('beneficiario', result.beneficiario);
      if (result.beneficiario_cnpj) form.setValue('beneficiario_cnpj', result.beneficiario_cnpj);
      if (result.valor) form.setValue('valor', result.valor);
      if (result.vencimento) form.setValue('vencimento', result.vencimento);
      if (result.linha_digitavel) form.setValue('linha_digitavel', result.linha_digitavel);
      if (result.codigo_barras) form.setValue('codigo_barras', result.codigo_barras);
      if (result.banco_codigo) form.setValue('banco_codigo', result.banco_codigo);
      if (result.banco_nome) form.setValue('banco_nome', result.banco_nome);

      setOcrConfidence(result.confidence);
    } catch (error) {
      console.error('OCR error:', error);
    }
  };

  const onSubmit = async (data: PayableFormData) => {
    try {
      // Validar duplicata antes de salvar
      if (data.codigo_barras) {
        const isDuplicate = await checkDuplicatePayableByCodigoBarras(data.codigo_barras);
        if (isDuplicate) {
          toast({
            variant: 'destructive',
            title: 'Boleto duplicado',
            description: 'Este código de barras já foi cadastrado anteriormente.',
          });
          return;
        }
      }

      if (data.linha_digitavel) {
        const isDuplicate = await checkDuplicatePayableByLinhaDigitavel(data.linha_digitavel);
        if (isDuplicate) {
          toast({
            variant: 'destructive',
            title: 'Boleto duplicado',
            description: 'Esta linha digitável já foi cadastrada anteriormente.',
          });
          return;
        }
      }

      await createPayable.mutateAsync({
        data: {
          ...data,
          tipo: 'boleto',
        },
        ocrConfidence: ocrConfidence ?? undefined,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error saving boleto:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Upload do Boleto
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
              <CardTitle>Dados do Boleto</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="beneficiario"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Beneficiário *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do beneficiário" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="beneficiario_cnpj"
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
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
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
                name="vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="banco_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do banco" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linha_digitavel"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Linha Digitável</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigo_barras"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Código de Barras</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00000000000000000000000000000000000000000000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parcela_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcela Nº</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parcela_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Parcelas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="supplier_invoice_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota Fiscal Vinculada</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {supplierInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            NF {inv.document_number} - {inv.supplier_name}
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
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Observações sobre o boleto..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={createPayable.isPending}>
              {createPayable.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Boleto
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
