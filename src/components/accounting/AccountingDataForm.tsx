import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { 
  ArrowLeft, 
  Users, 
  Wallet, 
  TrendingUp, 
  Save,
  Loader2,
  Calendar,
  Sparkles,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  useCompetenceData, 
  useSaveCompetenceData, 
  useCompetenceDocuments, 
  useProcessedTaxDocuments,
  useMarkDocumentsSynced,
  aggregateProcessedTaxDocs,
  type DocumentCategory,
  type ProcessedTaxDocument
} from '@/hooks/useAccountingCompetence';
import { AccountingFileUpload } from './AccountingFileUpload';
import { AccountingSmartUpload } from './AccountingSmartUpload';

export type FormSection = 'folha' | 'impostos' | 'receitas';

interface AccountingDataFormProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  section?: FormSection;
  onBack: () => void;
}

const formSchema = z.object({
  // Folha
  total_folha: z.coerce.number().min(0, 'Valor inválido'),
  encargos: z.coerce.number().min(0, 'Valor inválido'),
  prolabore: z.coerce.number().min(0, 'Valor inválido'),
  num_funcionarios: z.coerce.number().min(0, 'Valor inválido').int(),
  // Impostos
  das_valor: z.coerce.number().min(0, 'Valor inválido'),
  das_vencimento: z.string().optional().nullable(),
  darf_valor: z.coerce.number().min(0, 'Valor inválido'),
  darf_vencimento: z.string().optional().nullable(),
  gps_valor: z.coerce.number().min(0, 'Valor inválido'),
  gps_vencimento: z.string().optional().nullable(),
  inss_valor: z.coerce.number().min(0, 'Valor inválido'),
  inss_vencimento: z.string().optional().nullable(),
  fgts_valor: z.coerce.number().min(0, 'Valor inválido'),
  fgts_vencimento: z.string().optional().nullable(),
  iss_valor: z.coerce.number().min(0, 'Valor inválido'),
  iss_vencimento: z.string().optional().nullable(),
  // Receitas
  receita_servicos: z.coerce.number().min(0, 'Valor inválido'),
  receita_outras: z.coerce.number().min(0, 'Valor inválido'),
  receita_observacoes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

type TaxType = 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss';

const sectionLabels: Record<FormSection, string> = {
  folha: 'Folha de Pagamento',
  impostos: 'Impostos',
  receitas: 'Receitas',
};

export function AccountingDataForm({ unitId, unitName, competence, section, onBack }: AccountingDataFormProps) {
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const { data: existingData, isLoading } = useCompetenceData(unitId, ano, mes);
  const { data: documents = [], refetch: refetchDocuments } = useCompetenceDocuments(unitId, ano, mes);
  const { data: processedTaxDocs = [] } = useProcessedTaxDocuments(unitId, ano, mes);
  const saveMutation = useSaveCompetenceData();
  const markSyncedMutation = useMarkDocumentsSynced();
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });

  // Aggregate processed documents by tax type
  const processedByType = useMemo(() => {
    return aggregateProcessedTaxDocs(processedTaxDocs);
  }, [processedTaxDocs]);

  // Track which fields were pre-filled by AI
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  // Group documents by category
  const documentsByCategory = useMemo(() => {
    const grouped: Record<DocumentCategory, typeof documents[0] | null> = {
      folha: null,
      das: null,
      darf: null,
      gps: null,
      inss: null,
      fgts: null,
      iss: null,
      receitas: null,
    };
    documents.forEach(doc => {
      if (doc.categoria && !grouped[doc.categoria as DocumentCategory]) {
        grouped[doc.categoria as DocumentCategory] = doc;
      }
    });
    return grouped;
  }, [documents]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      total_folha: 0,
      encargos: 0,
      prolabore: 0,
      num_funcionarios: 0,
      das_valor: 0,
      das_vencimento: null,
      darf_valor: 0,
      darf_vencimento: null,
      gps_valor: 0,
      gps_vencimento: null,
      inss_valor: 0,
      inss_vencimento: null,
      fgts_valor: 0,
      fgts_vencimento: null,
      iss_valor: 0,
      iss_vencimento: null,
      receita_servicos: 0,
      receita_outras: 0,
      receita_observacoes: null,
    },
  });

  // Populate form with existing data OR processed documents
  useEffect(() => {
    if (existingData) {
      // Priority: existing saved data
      form.reset({
        total_folha: existingData.total_folha || 0,
        encargos: existingData.encargos || 0,
        prolabore: existingData.prolabore || 0,
        num_funcionarios: existingData.num_funcionarios || 0,
        das_valor: existingData.das_valor || 0,
        das_vencimento: existingData.das_vencimento || null,
        darf_valor: existingData.darf_valor || 0,
        darf_vencimento: existingData.darf_vencimento || null,
        gps_valor: existingData.gps_valor || 0,
        gps_vencimento: existingData.gps_vencimento || null,
        inss_valor: existingData.inss_valor || 0,
        inss_vencimento: existingData.inss_vencimento || null,
        fgts_valor: existingData.fgts_valor || 0,
        fgts_vencimento: existingData.fgts_vencimento || null,
        iss_valor: existingData.iss_valor || 0,
        iss_vencimento: existingData.iss_vencimento || null,
        receita_servicos: existingData.receita_servicos || 0,
        receita_outras: existingData.receita_outras || 0,
        receita_observacoes: existingData.receita_observacoes || null,
      });
    } else if (Object.keys(processedByType).length > 0) {
      // No existing data, but we have processed documents - pre-fill from AI
      const aiFields = new Set<string>();
      
      const taxTypes = ['das', 'darf', 'gps', 'inss', 'fgts', 'iss'] as const;
      taxTypes.forEach(tipo => {
        const doc = processedByType[tipo];
        if (doc?.valor) {
          form.setValue(`${tipo}_valor`, doc.valor);
          aiFields.add(`${tipo}_valor`);
        }
      });
      
      if (aiFields.size > 0) {
        setAiFilledFields(aiFields);
        
        toast.info(
          `${aiFields.size} campo(s) preenchido(s) automaticamente via Processamento Inteligente`,
          { duration: 5000 }
        );
      }
    }
  }, [existingData, processedByType, form]);

  // OCR completion handlers
  const handleOcrComplete = useCallback((taxType: TaxType, result: { valor: number | null; vencimento: string | null }) => {
    if (result.valor !== null) {
      form.setValue(`${taxType}_valor` as keyof FormData, result.valor);
    }
    if (result.vencimento) {
      form.setValue(`${taxType}_vencimento` as keyof FormData, result.vencimento);
    }
  }, [form]);

  // Smart upload handlers for auto-fill
  const handleSmartTaxApply = useCallback((taxType: TaxType, valor: number, vencimento: string | null) => {
    form.setValue(`${taxType}_valor` as keyof FormData, valor);
    if (vencimento) {
      form.setValue(`${taxType}_vencimento` as keyof FormData, vencimento);
    }
    toast.success(`${taxType.toUpperCase()} preenchido automaticamente via IA`);
  }, [form]);

  const handleSmartPayrollApply = useCallback((data: { 
    total_folha: number; 
    encargos: number; 
    prolabore: number; 
    num_funcionarios: number 
  }) => {
    form.setValue('total_folha', data.total_folha);
    form.setValue('encargos', data.encargos);
    form.setValue('prolabore', data.prolabore);
    form.setValue('num_funcionarios', data.num_funcionarios);
    toast.success('Folha de pagamento preenchida automaticamente via IA');
  }, [form]);

  const onSubmit = async (values: FormData) => {
    if (!unitId) {
      toast.error('Selecione uma unidade');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        unit_id: unitId,
        ano,
        mes,
        ...values,
      });
      
      // Mark processed documents as synced
      if (Object.keys(processedByType).length > 0) {
        await markSyncedMutation.mutateAsync({ unitId, ano, mes });
      }
      
      toast.success('Dados salvos com sucesso');
      onBack();
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Erro ao salvar dados');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Helper to render upload for taxes with OCR callback
  const renderTaxUpload = (categoria: TaxType) => {
    if (!unitId) return null;
    return (
      <AccountingFileUpload
        unitId={unitId}
        ano={ano}
        mes={mes}
        categoria={categoria}
        label="Anexar guia (opcional)"
        existingFile={documentsByCategory[categoria]}
        onUploadComplete={() => refetchDocuments()}
        onDeleteComplete={() => refetchDocuments()}
        onOcrComplete={(result) => handleOcrComplete(categoria, result)}
      />
    );
  };

  // Helper to render AI-filled badge for a tax type
  const renderAiBadge = (taxType: TaxType) => {
    const doc = processedByType[taxType];
    const isAiFilled = aiFilledFields.has(`${taxType}_valor`) || doc;
    
    if (!isAiFilled || !doc) return null;
    
    return (
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 cursor-help">
              <Sparkles className="h-3 w-3 mr-1" />
              Via IA
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">Preenchido automaticamente via Processamento Inteligente</p>
          </TooltipContent>
        </Tooltip>
        {doc.file_name && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from('accounting-documents')
                    .createSignedUrl(doc.file_path, 60);
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, '_blank');
                  }
                }}
              >
                <FileText className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{doc.file_name}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Ver documento processado</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Badge variant="secondary">
          {existingData ? 'Editando' : 'Novo registro'}
        </Badge>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">📋 Informar {section ? sectionLabels[section] : 'Dados Contábeis'}</p>
        <p className="text-xl font-semibold capitalize">{competenceLabel} — {unitName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {section ? `Preencha os dados de ${sectionLabels[section].toLowerCase()}` : 'Preencha os dados de folha, impostos e receitas para esta competência'}
        </p>
      </div>

      {/* Smart Upload Zone - AI analyzes and auto-fills */}
      {unitId && !section && (
        <AccountingSmartUpload
          unitId={unitId}
          ano={ano}
          mes={mes}
          onTaxApply={handleSmartTaxApply}
          onPayrollApply={handleSmartPayrollApply}
        />
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Folha de Pagamento */}
          {(!section || section === 'folha') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Folha de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="total_folha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Folha (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="encargos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Encargos (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prolabore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pró-labore (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="num_funcionarios"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Funcionários</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* File Upload for Folha */}
              {unitId && (
                <AccountingFileUpload
                  unitId={unitId}
                  ano={ano}
                  mes={mes}
                  categoria="folha"
                  label="Anexar folha (PDF/planilha)"
                  existingFile={documentsByCategory.folha}
                  onUploadComplete={() => refetchDocuments()}
                  onDeleteComplete={() => refetchDocuments()}
                  onPayrollOcrComplete={(result) => {
                    if (result.total_folha !== null) {
                      form.setValue('total_folha', result.total_folha);
                      toast.success('Total da folha preenchido automaticamente via IA');
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>
          )}

          {/* Impostos */}
          {(!section || section === 'impostos') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-orange-500" />
                Impostos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* DAS */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">DAS</p>
                    {processedByType['das'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="das_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="das_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('das')}
                  {renderTaxUpload('das')}
                </div>

                {/* DARF */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">DARF</p>
                    {processedByType['darf'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="darf_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="darf_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('darf')}
                  {renderTaxUpload('darf')}
                </div>

                {/* GPS */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">GPS</p>
                    {processedByType['gps'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="gps_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gps_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('gps')}
                  {renderTaxUpload('gps')}
                </div>

                {/* INSS */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">INSS</p>
                    {processedByType['inss'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="inss_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inss_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('inss')}
                  {renderTaxUpload('inss')}
                </div>

                {/* FGTS */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">FGTS</p>
                    {processedByType['fgts'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="fgts_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fgts_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('fgts')}
                  {renderTaxUpload('fgts')}
                </div>

                {/* ISS */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">ISS</p>
                    {processedByType['iss'] && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Processado
                      </Badge>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="iss_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iss_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Vencimento
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderAiBadge('iss')}
                  {renderTaxUpload('iss')}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Receitas */}
          {(!section || section === 'receitas') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receita_servicos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receita de Serviços (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receita_outras"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outras Receitas (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="receita_observacoes"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observações sobre receitas (opcional)"
                        rows={3}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* File Upload for Receitas */}
              {unitId && (
                <AccountingFileUpload
                  unitId={unitId}
                  ano={ano}
                  mes={mes}
                  categoria="receitas"
                  label="Anexar relatório de faturamento (opcional)"
                  existingFile={documentsByCategory.receitas}
                  onUploadComplete={() => refetchDocuments()}
                  onDeleteComplete={() => refetchDocuments()}
                />
              )}
            </CardContent>
          </Card>
          )}

          {/* Submit button */}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button 
              type="submit"
              size="lg" 
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Salvar Dados
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
