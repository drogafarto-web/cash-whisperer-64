import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Upload, Barcode, Loader2, Wand2, FileText, Plus, AlertCircle, Check, Clock, Receipt, FileWarning, FileCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

import { useBoletoOcr } from '@/features/payables/hooks/usePayableOcr';
import { useCreatePayable } from '@/features/payables/hooks/usePayables';
import { useCreateSupplierInvoice } from '@/features/payables/hooks/useSupplierInvoices';
import { 
  checkDuplicatePayableByCodigoBarras, 
  checkDuplicatePayableByLinhaDigitavel 
} from '@/features/payables/api/payables.api';
import { 
  findMatchingSupplierInvoices, 
  SupplierInvoiceMatch,
  updateInvoiceStatusOnBoletoLink,
} from '@/features/payables/api/supplier-invoices.api';
import { PayableFormData, SupplierInvoice, SupplierInvoiceFormData } from '@/types/payables';
import { toast } from 'sonner';

// Schema now makes supplier_invoice_id optional but requires justification when not linked
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
  nf_exemption_reason: z.string().optional(),
});

interface Props {
  units: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  supplierInvoices?: Array<{ id: string; document_number: string; supplier_name: string; supplier_cnpj?: string | null }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Inline NF creation form schema
const inlineNfSchema = z.object({
  document_number: z.string().min(1, 'Número é obrigatório'),
  supplier_name: z.string().min(1, 'Fornecedor é obrigatório'),
  supplier_cnpj: z.string().optional(),
  issue_date: z.string().min(1, 'Data é obrigatória'),
  total_value: z.number().min(0.01, 'Valor é obrigatório'),
});

type InlineNfFormData = z.infer<typeof inlineNfSchema>;
type BoletoTipo = 'compra' | 'imposto';

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
  const [showCreateNfDialog, setShowCreateNfDialog] = useState(false);
  const [matchingSuggestions, setMatchingSuggestions] = useState<SupplierInvoiceMatch[]>([]);
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [showExemptionForm, setShowExemptionForm] = useState(false);
  const [exemptionReason, setExemptionReason] = useState('');
  const [boletoTipo, setBoletoTipo] = useState<BoletoTipo>('compra');
  const [nfInSameDocument, setNfInSameDocument] = useState(false);

  const { processFile, isProcessing } = useBoletoOcr();
  const createPayable = useCreatePayable();
  const createSupplierInvoice = useCreateSupplierInvoice();

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

  const inlineNfForm = useForm<InlineNfFormData>({
    resolver: zodResolver(inlineNfSchema),
    defaultValues: {
      document_number: '',
      supplier_name: '',
      supplier_cnpj: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      total_value: 0,
    },
  });

  const watchedCnpj = form.watch('beneficiario_cnpj');
  const watchedValor = form.watch('valor');

  // Auto-search for matching invoices when CNPJ or value changes (only for 'compra' type)
  useEffect(() => {
    if (boletoTipo !== 'compra') {
      setMatchingSuggestions([]);
      return;
    }

    const searchMatches = async () => {
      if (!watchedCnpj && !watchedValor) {
        setMatchingSuggestions([]);
        return;
      }

      setIsSearchingMatches(true);
      try {
        const matches = await findMatchingSupplierInvoices(watchedCnpj, watchedValor);
        setMatchingSuggestions(matches);
      } catch (error) {
        console.error('Error searching matches:', error);
      } finally {
        setIsSearchingMatches(false);
      }
    };

    const debounce = setTimeout(searchMatches, 500);
    return () => clearTimeout(debounce);
  }, [watchedCnpj, watchedValor, boletoTipo]);

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

  const handleSelectMatch = async (match: SupplierInvoiceMatch) => {
    form.setValue('supplier_invoice_id', match.invoice.id);
    
    // Update invoice status if it was waiting for boleto
    if (match.invoice.status === 'aguardando_boleto') {
      await updateInvoiceStatusOnBoletoLink(match.invoice.id);
    }
    
    toast.success('NF vinculada', {
      description: `NF ${match.invoice.document_number} - ${match.invoice.supplier_name}`,
    });
  };

  const handleCreateInlineNf = async (data: InlineNfFormData) => {
    try {
      const invoiceData: SupplierInvoiceFormData = {
        document_number: data.document_number,
        supplier_name: data.supplier_name,
        supplier_cnpj: data.supplier_cnpj,
        issue_date: data.issue_date,
        total_value: data.total_value,
        payment_method: 'boleto',
      };

      const newInvoice = await createSupplierInvoice.mutateAsync({
        data: invoiceData,
      });

      form.setValue('supplier_invoice_id', newInvoice.id);
      setShowCreateNfDialog(false);
      inlineNfForm.reset();
      
      toast.success('NF criada e vinculada', {
        description: `NF ${newInvoice.document_number} foi criada com sucesso.`,
      });
    } catch (error) {
      console.error('Error creating inline NF:', error);
    }
  };

  const openCreateNfWithPrefill = () => {
    // Prefill the inline NF form with boleto data
    const beneficiario = form.getValues('beneficiario');
    const cnpj = form.getValues('beneficiario_cnpj');
    const valor = form.getValues('valor');

    inlineNfForm.setValue('supplier_name', beneficiario);
    if (cnpj) inlineNfForm.setValue('supplier_cnpj', cnpj);
    if (valor) inlineNfForm.setValue('total_value', valor);

    setShowCreateNfDialog(true);
  };

  const onSubmit = async (data: PayableFormData) => {
    try {
      // Validar duplicata antes de salvar
      if (data.codigo_barras) {
        const isDuplicate = await checkDuplicatePayableByCodigoBarras(data.codigo_barras);
        if (isDuplicate) {
          toast.error('Boleto duplicado', {
            description: 'Este código de barras já foi cadastrado anteriormente.',
          });
          return;
        }
      }

      if (data.linha_digitavel) {
        const isDuplicate = await checkDuplicatePayableByLinhaDigitavel(data.linha_digitavel);
        if (isDuplicate) {
          toast.error('Boleto duplicado', {
            description: 'Esta linha digitável já foi cadastrada anteriormente.',
          });
          return;
        }
      }

      // Determine nf_vinculacao_status based on type and invoice link
      let nfVinculacaoStatus: 'nao_requer' | 'pendente' | 'vinculado' = 'nao_requer';
      let nfExemptionReason: string | undefined = undefined;
      let nfInSameDoc = false;
      
      if (boletoTipo === 'compra') {
        if (data.supplier_invoice_id) {
          nfVinculacaoStatus = 'vinculado';
        } else if (nfInSameDocument) {
          // NF is in the same document - mark as vinculado with flag
          nfVinculacaoStatus = 'vinculado';
          nfInSameDoc = true;
        } else {
          // If no NF linked for 'compra', require justification
          if (!showExemptionForm) {
            // First time clicking submit without NF - show exemption form
            setShowExemptionForm(true);
            toast.info('Justificativa necessária', {
              description: 'Por favor, explique o motivo de cadastrar sem NF.',
            });
            return;
          }
          
          // Validate exemption reason
          if (!exemptionReason || exemptionReason.trim().length < 10) {
            toast.error('Justificativa obrigatória', {
              description: 'Informe o motivo (mínimo 10 caracteres) para cadastrar sem NF.',
            });
            return;
          }
          
          nfVinculacaoStatus = 'nao_requer';
          nfExemptionReason = exemptionReason.trim();
        }
      }

      await createPayable.mutateAsync({
        data: {
          ...data,
          tipo: 'boleto',
        },
        ocrConfidence: ocrConfidence ?? undefined,
        nfVinculacaoStatus,
        nfExemptionReason,
        nfInSameDocument: nfInSameDoc,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error saving boleto:', error);
    }
  };

  const selectedInvoiceId = form.watch('supplier_invoice_id');
  const selectedInvoice = supplierInvoices.find(inv => inv.id === selectedInvoiceId);
  const showNfSection = boletoTipo === 'compra';
  const hasNoNfLinked = showNfSection && !selectedInvoiceId && !nfInSameDocument;

  return (
    <div className="space-y-6">
      {/* Tipo de Boleto Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tipo de Pagamento
          </CardTitle>
          <CardDescription>
            Selecione o tipo de documento para cadastro adequado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={boletoTipo}
            onValueChange={(value: BoletoTipo) => {
              setBoletoTipo(value);
              if (value === 'imposto') {
                form.setValue('supplier_invoice_id', '');
              }
            }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="compra" id="compra" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="compra" className="cursor-pointer font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Boleto de Compra
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Pagamento de fornecedor com NF vinculada
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="imposto" id="imposto" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="imposto" className="cursor-pointer font-medium flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Imposto / Taxa
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  DAS, DARF, GPS, FGTS, etc. (não requer NF)
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

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

      {/* NF Linking Section - Only for 'compra' type */}
      {showNfSection && (
        <Card className={hasNoNfLinked ? 'border-amber-500' : 'border-primary'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Nota Fiscal Vinculada
            </CardTitle>
            <CardDescription>
              Vincule este boleto a uma Nota Fiscal de fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasNoNfLinked && !showExemptionForm && (
              <Alert className="border-amber-500 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Este boleto será salvo como <strong>"Pendente Vinculação"</strong>.
                  Você poderá vincular a NF posteriormente, ou informar o motivo da dispensa.
                </AlertDescription>
              </Alert>
            )}

            {/* Exemption Reason Form */}
            {hasNoNfLinked && showExemptionForm && (
              <Alert className="border-primary bg-primary/5">
                <FileWarning className="h-4 w-4 text-primary" />
                <AlertDescription className="text-foreground">
                  <div className="space-y-3">
                    <p className="font-medium">Por que este boleto não precisa de NF?</p>
                    <Textarea
                      value={exemptionReason}
                      onChange={(e) => setExemptionReason(e.target.value)}
                      placeholder="Ex: Serviço de pessoa física (RPA), taxa governamental, reembolso de despesa..."
                      className="min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 10 caracteres. Exemplos: serviço PF, taxa cartório, reembolso viagem.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Matching Suggestions */}
            {matchingSuggestions.length > 0 && !selectedInvoiceId && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Sugestões encontradas ({matchingSuggestions.length}):
                </p>
                <div className="space-y-2">
                  {matchingSuggestions.slice(0, 3).map((match) => (
                    <div
                      key={match.invoice.id}
                      className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer ${
                        match.invoice.status === 'aguardando_boleto' ? 'border-amber-500 bg-amber-500/5' : ''
                      }`}
                      onClick={() => handleSelectMatch(match)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            NF {match.invoice.document_number} - {match.invoice.supplier_name}
                          </p>
                          {match.invoice.status === 'aguardando_boleto' && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                              <Clock className="h-3 w-3 mr-1" />
                              Aguardando Boleto
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {match.matchReasons.map((reason, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline">
                        <Check className="h-4 w-4 mr-1" />
                        Vincular
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSearchingMatches && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando NFs correspondentes...
              </div>
            )}

            <Form {...form}>
              <FormField
                control={form.control}
                name="supplier_invoice_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selecionar NF Existente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma NF..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            </Form>

            {selectedInvoice && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  NF {selectedInvoice.document_number} - {selectedInvoice.supplier_name}
                </p>
              </div>
            )}

            {/* Option to mark NF as in same document */}
            {!selectedInvoiceId && (
              <div 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  nfInSameDocument 
                    ? 'bg-green-500/10 border-green-500' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => setNfInSameDocument(!nfInSameDocument)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                    nfInSameDocument ? 'bg-green-500 border-green-500' : 'border-muted-foreground'
                  }`}>
                    {nfInSameDocument && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      A NF já está anexada ao documento
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Marque se o PDF do boleto já inclui a Nota Fiscal (ex: NFS-e)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ou</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCreateNfWithPrefill}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar NF para este Boleto
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                        placeholder="0,00"
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
                name="linha_digitavel"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 lg:col-span-3">
                    <FormLabel>Linha Digitável</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Digite ou cole a linha digitável" />
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
                      <Input {...field} placeholder="Digite ou cole o código de barras" />
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Observações sobre o pagamento" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
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

      {/* Create NF Dialog */}
      <Dialog open={showCreateNfDialog} onOpenChange={setShowCreateNfDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Nota Fiscal</DialogTitle>
            <DialogDescription>
              Crie uma NF para vincular a este boleto. Você poderá complementar os dados depois.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...inlineNfForm}>
            <form onSubmit={inlineNfForm.handleSubmit(handleCreateInlineNf)} className="space-y-4">
              <FormField
                control={inlineNfForm.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da NF *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Número do documento" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inlineNfForm.control}
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
                control={inlineNfForm.control}
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={inlineNfForm.control}
                  name="issue_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Emissão *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={inlineNfForm.control}
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
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateNfDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createSupplierInvoice.isPending}>
                  {createSupplierInvoice.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar e Vincular
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
