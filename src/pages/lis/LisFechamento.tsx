import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Upload, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  AlertCircle, 
  FileText, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  Filter,
  Banknote,
  Package
} from 'lucide-react';
import { parseLisCsv, parseLisXls, LisRecord } from '@/utils/lisImport';
import { generateEnvelopeZpl, downloadZplFile } from '@/utils/zpl';
import { reconcileLisItems, updateReconciliationStatus, countByComprovanteStatus } from '@/services/lisReconciliation';
import { 
  isWebUSBSupported, 
  requestPrinter, 
  connectPrinter, 
  printZpl, 
  disconnectPrinter, 
  getPrinterStatus,
  reconnectToPairedDevice,
  ZebraPrinterDevice 
} from '@/utils/zebraPrinter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface LisClosure {
  id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_dinheiro: number;
  total_pix: number;
  total_cartao_liquido: number;
  total_taxa_cartao: number;
  total_nao_pago: number;
  itens_sem_comprovante: number;
  conferencia_checkbox: boolean;
  created_by: string;
  created_at: string;
  closed_by?: string;
  closed_at?: string;
}

interface ClosureItem {
  id: string;
  closure_id: string;
  lis_code: string;
  date: string;
  patient_name: string | null;
  convenio: string | null;
  payment_method: string;
  amount: number;
  gross_amount: number | null;
  discount_value: number | null;
  discount_percent: number | null;
  discount_reason: string | null;
  card_fee_value: number | null;
  net_amount: number | null;
  status: string;
  justificativa: string | null;
  comprovante_status: string;
}

interface CashEnvelope {
  id: string;
  closure_id: string;
  cash_total: number;
  lis_codes: string[];
  conferencia_checkbox: boolean;
  label_printed_at: string | null;
  label_printed_by: string | null;
  status: string;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  DINHEIRO: <Banknote className="h-4 w-4 text-green-600" />,
  PIX: <Smartphone className="h-4 w-4 text-purple-600" />,
  CARTAO: <CreditCard className="h-4 w-4 text-blue-600" />,
  BOLETO: <FileText className="h-4 w-4 text-orange-600" />,
  NAO_PAGO: <XCircle className="h-4 w-4 text-red-600" />,
};

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NORMAL: { label: 'OK', variant: 'default' },
  NAO_PAGO: { label: 'Não Pago', variant: 'destructive' },
  JUSTIFICADO: { label: 'Justificado', variant: 'secondary' },
  SEM_COMPROVANTE: { label: 'Sem Comprv.', variant: 'outline' },
};

const COMPROVANTE_ICONS: Record<string, React.ReactNode> = {
  CONCILIADO: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  SEM_COMPROVANTE: <XCircle className="h-4 w-4 text-red-600" />,
  DUPLICIDADE: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  PENDENTE: <AlertCircle className="h-4 w-4 text-gray-400" />,
};

export default function LisFechamento() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Estados do fechamento
  const [currentClosure, setCurrentClosure] = useState<LisClosure | null>(null);
  const [closureItems, setClosureItems] = useState<ClosureItem[]>([]);
  const [cashEnvelope, setCashEnvelope] = useState<CashEnvelope | null>(null);

  // Estados de UI
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [envelopeCheckbox, setEnvelopeCheckbox] = useState(false);
  const [finalCheckbox, setFinalCheckbox] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zplDialogOpen, setZplDialogOpen] = useState(false);
  const [zplContent, setZplContent] = useState('');
  const [cardFees, setCardFees] = useState<Array<{ id: string; name: string; fee_percent: number }>>([]);
  
  // Estados para diálogo de confirmação de período
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [detectedPeriod, setDetectedPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pendingRecords, setPendingRecords] = useState<LisRecord[] | null>(null);

  // Printer state
  const [printer, setPrinter] = useState<ZebraPrinterDevice | null>(null);
  const [printerConnecting, setPrinterConnecting] = useState(false);
  const webUSBSupported = isWebUSBSupported();

  // Carregar dados iniciais
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    fetchInitialData();
  }, [authLoading, user, navigate]);

  const fetchInitialData = async () => {
    try {
      const [unitsRes, cardFeesRes] = await Promise.all([
        supabase.from('units').select('id, name, code').order('name'),
        supabase.from('card_fee_config').select('id, name, fee_percent').eq('active', true),
      ]);

      if (unitsRes.data) setUnits(unitsRes.data);
      if (cardFeesRes.data) setCardFees(cardFeesRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar fechamento existente
  const fetchExistingClosure = async (
    overridePeriodStart?: string,
    overridePeriodEnd?: string
  ) => {
    const pStart = overridePeriodStart || periodStart;
    const pEnd = overridePeriodEnd || periodEnd;
    
    if (!selectedUnitId || !pStart || !pEnd) return;

    setLoading(true);
    try {
      // Buscar fechamento existente para o período/unidade
      const { data: closure, error } = await supabase
        .from('lis_closures')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .eq('period_start', pStart)
        .eq('period_end', pEnd)
        .maybeSingle();

      if (error) throw error;

      if (closure) {
        setCurrentClosure(closure);
        
        // Buscar itens do fechamento
        const { data: items } = await supabase
          .from('lis_closure_items')
          .select('*')
          .eq('closure_id', closure.id)
          .order('date', { ascending: true });

        if (items) setClosureItems(items);

        // Buscar envelope de dinheiro
        const { data: envelope } = await supabase
          .from('cash_envelopes')
          .select('*')
          .eq('closure_id', closure.id)
          .maybeSingle();

        if (envelope) setCashEnvelope(envelope);
      } else {
        setCurrentClosure(null);
        setClosureItems([]);
        setCashEnvelope(null);
      }
    } catch (error) {
      console.error('Erro ao buscar fechamento:', error);
      toast({ title: 'Erro', description: 'Erro ao buscar fechamento existente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUnitId && periodStart && periodEnd) {
      fetchExistingClosure();
    }
  }, [selectedUnitId, periodStart, periodEnd]);

  // Importar arquivo CSV/XLS
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // Validação explícita da unidade
    if (!selectedUnitId) {
      toast({ 
        title: 'Selecione a unidade', 
        description: 'É necessário selecionar a unidade antes de importar o arquivo LIS.',
        variant: 'destructive' 
      });
      event.target.value = '';
      return;
    }
    
    if (!file || !user) return;

    setImporting(true);
    try {
      let result: { records: LisRecord[]; periodStart: string | null; periodEnd: string | null; totalRecords: number };
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const content = await file.text();
        result = parseLisCsv(content, cardFees);
      } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer();
        result = parseLisXls(buffer, cardFees);
      } else {
        throw new Error('Formato não suportado. Use CSV ou XLS/XLSX.');
      }

      // Filtrar por unidade selecionada
      const selectedUnit = units.find(u => u.id === selectedUnitId);
      const filteredRecords = result.records.filter(r => r.unitId === selectedUnitId);

      // Mostrar resumo pós-parse
      toast({ 
        title: 'Arquivo lido', 
        description: `${result.totalRecords} linhas lidas. ${filteredRecords.length} da unidade ${selectedUnit?.name}. Período: ${result.periodStart || 'N/A'} a ${result.periodEnd || 'N/A'}`,
      });

      if (filteredRecords.length === 0) {
        toast({ 
          title: 'Aviso', 
          description: `Nenhum registro encontrado para a unidade ${selectedUnit?.name}`, 
          variant: 'destructive' 
        });
        return;
      }

      // Verificar se período do arquivo difere da tela
      if (result.periodStart && result.periodEnd) {
        const filePeriodDiffers = result.periodStart !== periodStart || result.periodEnd !== periodEnd;
        
        if (filePeriodDiffers) {
          // Salvar dados e mostrar diálogo de confirmação
          setDetectedPeriod({ start: result.periodStart, end: result.periodEnd });
          setPendingRecords(filteredRecords);
          setPeriodDialogOpen(true);
          return;
        }
      }

      // Se período igual, processar diretamente
      await processImport(filteredRecords, periodStart, periodEnd);
    } catch (error: unknown) {
      console.error('Erro ao importar arquivo:', error);
      toast({ 
        title: 'Erro', 
        description: error instanceof Error ? error.message : 'Erro ao importar arquivo', 
        variant: 'destructive' 
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  // Processar importação com período definido
  const processImport = async (records: LisRecord[], pStart: string, pEnd: string) => {
    if (!user) return;
    
    setImporting(true);
    try {
      // Criar ou atualizar fechamento
      let closureId = currentClosure?.id;

      if (!closureId) {
        const { data: newClosure, error } = await supabase
          .from('lis_closures')
          .insert({
            unit_id: selectedUnitId,
            period_start: pStart,
            period_end: pEnd,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        closureId = newClosure.id;
        setCurrentClosure(newClosure);
      }

      // Inserir itens
      const itemsToInsert = records.map(record => ({
        closure_id: closureId,
        lis_code: record.codigo || record.paciente?.substring(0, 10) || 'N/A',
        date: record.data,
        patient_name: record.paciente,
        convenio: record.convenio,
        payment_method: record.paymentMethod,
        amount: record.valorPago,
        gross_amount: record.valorBruto || record.valorPago,
        discount_value: record.valorDesconto || 0,
        discount_percent: record.percentualDesconto || 0,
        discount_reason: record.discountReason || null,
        card_fee_value: record.cardFeeValue || 0,
        card_fee_percent: record.cardFeePercent || 0,
        net_amount: record.valorLiquido || record.valorPago,
        status: record.isNaoPago ? 'NAO_PAGO' : 'NORMAL',
      }));

      const { error: insertError } = await supabase
        .from('lis_closure_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      // Recalcular totais
      await updateClosureTotals(closureId);

      // Recarregar dados com período correto (passando explicitamente)
      await fetchExistingClosure(pStart, pEnd);

      toast({ title: 'Sucesso', description: `${records.length} registros importados` });
    } catch (error: unknown) {
      console.error('Erro ao processar importação:', error);
      toast({ 
        title: 'Erro', 
        description: error instanceof Error ? error.message : 'Erro ao importar', 
        variant: 'destructive' 
      });
    } finally {
      setImporting(false);
    }
  };

  // Confirmar uso do período do arquivo
  const handleConfirmFilePeriod = async () => {
    if (!detectedPeriod || !pendingRecords) return;
    
    setPeriodStart(detectedPeriod.start);
    setPeriodEnd(detectedPeriod.end);
    setPeriodDialogOpen(false);
    
    await processImport(pendingRecords, detectedPeriod.start, detectedPeriod.end);
    
    setDetectedPeriod(null);
    setPendingRecords(null);
  };

  // Manter período da tela
  const handleKeepScreenPeriod = async () => {
    if (!pendingRecords) return;
    
    setPeriodDialogOpen(false);
    await processImport(pendingRecords, periodStart, periodEnd);
    
    setDetectedPeriod(null);
    setPendingRecords(null);
  };

  // Atualizar totais do fechamento
  const updateClosureTotals = async (closureId: string) => {
    const { data: items } = await supabase
      .from('lis_closure_items')
      .select('payment_method, amount, card_fee_value, net_amount, status, comprovante_status')
      .eq('closure_id', closureId);

    if (!items) return;

    const totals = {
      total_dinheiro: items.filter(i => i.payment_method === 'DINHEIRO').reduce((sum, i) => sum + (i.amount || 0), 0),
      total_pix: items.filter(i => i.payment_method === 'PIX').reduce((sum, i) => sum + (i.amount || 0), 0),
      total_cartao_liquido: items.filter(i => i.payment_method === 'CARTAO').reduce((sum, i) => sum + (i.net_amount || i.amount || 0), 0),
      total_taxa_cartao: items.filter(i => i.payment_method === 'CARTAO').reduce((sum, i) => sum + (i.card_fee_value || 0), 0),
      total_nao_pago: items.filter(i => i.status === 'NAO_PAGO').reduce((sum, i) => sum + (i.amount || 0), 0),
      itens_sem_comprovante: items.filter(i => i.comprovante_status === 'SEM_COMPROVANTE' || i.comprovante_status === 'PENDENTE').length,
    };

    await supabase.from('lis_closures').update(totals).eq('id', closureId);

    // Atualizar/criar envelope de dinheiro
    const dinheiroItems = items.filter(i => i.payment_method === 'DINHEIRO');
    if (dinheiroItems.length > 0) {
      const { data: existingItems } = await supabase
        .from('lis_closure_items')
        .select('lis_code')
        .eq('closure_id', closureId)
        .eq('payment_method', 'DINHEIRO');

      const lisCodes = existingItems?.map(i => i.lis_code) || [];

      const { data: existingEnvelope } = await supabase
        .from('cash_envelopes')
        .select('id')
        .eq('closure_id', closureId)
        .maybeSingle();

      if (existingEnvelope) {
        await supabase.from('cash_envelopes').update({
          cash_total: totals.total_dinheiro,
          lis_codes: lisCodes,
        }).eq('id', existingEnvelope.id);
      } else {
        await supabase.from('cash_envelopes').insert({
          closure_id: closureId,
          unit_id: currentClosure?.unit_id || selectedUnitId,
          cash_total: totals.total_dinheiro,
          lis_codes: lisCodes,
        });
      }
    }
  };

  // Atualizar justificativa de item
  const handleUpdateItem = async (itemId: string, updates: Partial<ClosureItem>) => {
    try {
      const { error } = await supabase
        .from('lis_closure_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      setClosureItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  // Conciliar com comprovantes
  const handleReconcile = async () => {
    if (!currentClosure) return;

    setLoading(true);
    try {
      const results = await reconcileLisItems(currentClosure.id);
      await updateReconciliationStatus(results);
      
      const counts = countByComprovanteStatus(results);
      await fetchExistingClosure();

      toast({ 
        title: 'Conciliação concluída', 
        description: `${counts.conciliado} conciliados, ${counts.semComprovante} sem comprovante, ${counts.duplicidade} duplicidades` 
      });
    } catch (error) {
      console.error('Erro na conciliação:', error);
      toast({ title: 'Erro', description: 'Erro ao conciliar comprovantes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Conectar impressora Zebra
  const handleConnectPrinter = async () => {
    setPrinterConnecting(true);
    try {
      const device = await requestPrinter();
      if (device) {
        await connectPrinter(device);
        setPrinter(device);
        toast({ title: 'Impressora conectada', description: device.name });
      }
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setPrinterConnecting(false);
    }
  };

  // Imprimir ZPL diretamente
  const handleDirectPrint = async (zplToPrint: string) => {
    try {
      await printZpl(zplToPrint);
      toast({ title: 'Impresso!', description: 'Etiqueta enviada para a impressora' });
    } catch (error) {
      toast({ title: 'Erro ao imprimir', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleGenerateLabel = async () => {
    if (!currentClosure || !cashEnvelope || !user || !envelopeCheckbox) return;

    if (cashEnvelope.label_printed_at) {
      toast({ 
        title: 'Etiqueta já emitida', 
        description: 'Não é possível gerar segunda via. Confira o envelope físico.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      const selectedUnit = units.find(u => u.id === currentClosure.unit_id);
      
      const zpl = generateEnvelopeZpl({
        unitName: selectedUnit?.name || 'Unidade',
        unitCode: selectedUnit?.code || 'UND',
        periodStart: format(new Date(currentClosure.period_start), 'dd/MM/yyyy'),
        periodEnd: format(new Date(currentClosure.period_end), 'dd/MM/yyyy'),
        cashTotal: cashEnvelope.cash_total,
        lisCodes: cashEnvelope.lis_codes,
        closedByName: profile?.name || 'Usuário',
        closureId: currentClosure.id,
      });

      // Atualizar envelope com data de impressão
      await supabase.from('cash_envelopes').update({
        label_printed_at: new Date().toISOString(),
        label_printed_by: user.id,
        conferencia_checkbox: true,
        status: 'EMITIDO',
      }).eq('id', cashEnvelope.id);

      setZplContent(zpl);
      setZplDialogOpen(true);

      // Recarregar envelope
      const { data: updatedEnvelope } = await supabase
        .from('cash_envelopes')
        .select('*')
        .eq('id', cashEnvelope.id)
        .single();

      if (updatedEnvelope) setCashEnvelope(updatedEnvelope);

      toast({ title: 'Sucesso', description: 'Etiqueta gerada com sucesso' });
    } catch (error) {
      console.error('Erro ao gerar etiqueta:', error);
      toast({ title: 'Erro', description: 'Erro ao gerar etiqueta', variant: 'destructive' });
    }
  };

  // Fechar caixa
  const handleCloseClosure = async () => {
    if (!currentClosure || !user) return;

    // Validações
    const naoPagosNaoJustificados = closureItems.filter(
      i => i.status === 'NAO_PAGO' && !i.justificativa
    );

    if (naoPagosNaoJustificados.length > 0) {
      toast({ 
        title: 'Validação', 
        description: `${naoPagosNaoJustificados.length} item(s) não pago(s) sem justificativa`, 
        variant: 'destructive' 
      });
      return;
    }

    if (currentClosure.total_dinheiro > 0 && !cashEnvelope?.label_printed_at) {
      toast({ 
        title: 'Validação', 
        description: 'É necessário emitir a etiqueta do envelope de dinheiro antes de fechar', 
        variant: 'destructive' 
      });
      return;
    }

    if (!finalCheckbox) {
      toast({ 
        title: 'Validação', 
        description: 'Marque o checkbox de conferência final', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      await supabase.from('lis_closures').update({
        status: 'FECHADO',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        conferencia_checkbox: true,
      }).eq('id', currentClosure.id);

      toast({ title: 'Sucesso', description: 'Fechamento concluído com sucesso' });
      await fetchExistingClosure();
    } catch (error) {
      console.error('Erro ao fechar:', error);
      toast({ title: 'Erro', description: 'Erro ao fechar caixa', variant: 'destructive' });
    }
  };

  // Itens filtrados
  const filteredItems = useMemo(() => {
    return closureItems.filter(item => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterPayment !== 'all' && item.payment_method !== filterPayment) return false;
      return true;
    });
  }, [closureItems, filterStatus, filterPayment]);

  // Resumos
  const summaryData = useMemo(() => {
    return {
      dinheiro: closureItems.filter(i => i.payment_method === 'DINHEIRO').reduce((sum, i) => sum + (i.amount || 0), 0),
      pix: closureItems.filter(i => i.payment_method === 'PIX').reduce((sum, i) => sum + (i.amount || 0), 0),
      cartaoLiquido: closureItems.filter(i => i.payment_method === 'CARTAO').reduce((sum, i) => sum + (i.net_amount || i.amount || 0), 0),
      taxaCartao: closureItems.filter(i => i.payment_method === 'CARTAO').reduce((sum, i) => sum + (i.card_fee_value || 0), 0),
      naoPago: closureItems.filter(i => i.status === 'NAO_PAGO').length,
      semComprovante: closureItems.filter(i => i.comprovante_status === 'SEM_COMPROVANTE').length,
    };
  }, [closureItems]);

  const isClosed = currentClosure?.status === 'FECHADO';
  const selectedUnit = units.find(u => u.id === selectedUnitId);

  if (loading && units.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fechamento de Caixa LIS</h1>
            <p className="text-muted-foreground">Conferência por forma de pagamento e envelope de dinheiro</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(!helpOpen)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Ajuda
          </Button>
        </div>

        {/* Help Block */}
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleContent>
            <Alert className="mb-4">
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Como fazer o fechamento de caixa</AlertTitle>
              <AlertDescription className="mt-2 space-y-1 text-sm">
                <p>1. Faça o upload do CSV/XLS do LIS</p>
                <p>2. Confira cada código LIS: valor e forma de pagamento</p>
                <p>3. <strong>Dinheiro:</strong> Some os valores, conte o caixa físico, coloque o valor exato no envelope</p>
                <p>4. Gere a etiqueta do envelope apenas depois de conferir; <strong>essa etiqueta só é emitida uma vez</strong></p>
                <p>5. <strong>Pix/Cartão:</strong> Confira com extrato bancário e relatório da maquininha</p>
                <p>6. Justifique qualquer código LIS sem pagamento registrado</p>
                <p>7. Só clique em "Fechar caixa" depois de revisar tudo</p>
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </Collapsible>

        {/* Seleção de Parâmetros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros do Fechamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="unit">Unidade</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isClosed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="periodStart">Data Inicial</Label>
                <Input 
                  type="date" 
                  value={periodStart} 
                  onChange={e => setPeriodStart(e.target.value)}
                  disabled={isClosed}
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">Data Final</Label>
                <Input 
                  type="date" 
                  value={periodEnd} 
                  onChange={e => setPeriodEnd(e.target.value)}
                  disabled={isClosed}
                />
              </div>
              <div className="flex items-end">
                <div className="w-full">
                  <Label htmlFor="file" className="sr-only">Importar CSV/XLS</Label>
                  <Input 
                    id="file"
                    type="file" 
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileUpload}
                    disabled={importing || isClosed || !selectedUnitId}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>
            {importing && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Importando arquivo...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status do Fechamento */}
        {currentClosure && (
          <Alert variant={isClosed ? 'default' : 'destructive'} className={isClosed ? 'border-green-500 bg-green-50' : ''}>
            {isClosed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{isClosed ? 'Fechamento Concluído' : 'Fechamento em Andamento'}</AlertTitle>
            <AlertDescription>
              {isClosed 
                ? `Fechado em ${format(new Date(currentClosure.closed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                : `Criado em ${format(new Date(currentClosure.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Resumo por Forma de Pagamento */}
        {closureItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Dinheiro</span>
                </div>
                <p className="text-xl font-bold text-green-700 mt-1">
                  R$ {summaryData.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Pix</span>
                </div>
                <p className="text-xl font-bold text-purple-700 mt-1">
                  R$ {summaryData.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Cartão (líq.)</span>
                </div>
                <p className="text-xl font-bold text-blue-700 mt-1">
                  R$ {summaryData.cartaoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Taxa Cartão</span>
                </div>
                <p className="text-xl font-bold text-orange-700 mt-1">
                  R$ {summaryData.taxaCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Não Pagos</span>
                </div>
                <p className="text-xl font-bold text-red-700 mt-1">{summaryData.naoPago}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Sem Comprv.</span>
                </div>
                <p className="text-xl font-bold text-yellow-700 mt-1">{summaryData.semComprovante}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Envelope de Dinheiro */}
        {currentClosure && summaryData.dinheiro > 0 && (
          <Card className="border-green-300">
            <CardHeader className="bg-green-50 border-b border-green-200">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg text-green-800">Envelope de Dinheiro</CardTitle>
              </div>
              <CardDescription>
                Confira o valor em espécie e coloque no envelope antes de gerar a etiqueta
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor esperado no envelope:</p>
                  <p className="text-3xl font-bold text-green-700">
                    R$ {summaryData.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Códigos LIS:</p>
                  <p className="text-lg font-semibold">{cashEnvelope?.lis_codes?.length || 0} códigos</p>
                </div>
              </div>

              {cashEnvelope?.label_printed_at ? (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Etiqueta já emitida</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Emitida em {format(new Date(cashEnvelope.label_printed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
                    <br />
                    <strong>Não existe segunda via.</strong> Confira o envelope físico.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="envelope-check" 
                      checked={envelopeCheckbox}
                      onCheckedChange={(checked) => setEnvelopeCheckbox(checked as boolean)}
                      disabled={isClosed}
                    />
                    <Label htmlFor="envelope-check" className="text-sm">
                      Conferi e coloquei no envelope exatamente o valor em dinheiro indicado (R$ {summaryData.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </Label>
                  </div>
                  <Button 
                    onClick={handleGenerateLabel}
                    disabled={!envelopeCheckbox || isClosed}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Gerar Etiqueta do Envelope
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabela de Códigos LIS */}
        {closureItems.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Códigos LIS ({closureItems.length} itens)</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReconcile} disabled={isClosed}>
                    <FileText className="h-4 w-4 mr-2" />
                    Verificar Comprovantes
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="NORMAL">OK</SelectItem>
                      <SelectItem value="NAO_PAGO">Não Pago</SelectItem>
                      <SelectItem value="JUSTIFICADO">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={filterPayment} onValueChange={setFilterPayment}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="PIX">Pix</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                      <SelectItem value="NAO_PAGO">Não Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead className="w-[100px]">Valor</TableHead>
                      <TableHead className="w-[80px]">Pag.</TableHead>
                      <TableHead className="w-[80px]">Comprv.</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Justificativa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => (
                      <TableRow 
                        key={item.id} 
                        className={item.status === 'NAO_PAGO' ? 'bg-red-50' : ''}
                      >
                        <TableCell className="text-sm">
                          {format(new Date(item.date), 'dd/MM')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.lis_code}</TableCell>
                        <TableCell className="text-sm truncate max-w-[200px]">{item.patient_name}</TableCell>
                        <TableCell className="text-sm font-medium">
                          R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{PAYMENT_METHOD_ICONS[item.payment_method] || item.payment_method}</TableCell>
                        <TableCell>{COMPROVANTE_ICONS[item.comprovante_status]}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGES[item.status]?.variant || 'default'}>
                            {STATUS_BADGES[item.status]?.label || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.status === 'NAO_PAGO' && !isClosed && (
                            <div className="flex gap-2 items-center">
                              <Input
                                placeholder="Motivo..."
                                value={item.justificativa || ''}
                                onChange={e => handleUpdateItem(item.id, { justificativa: e.target.value })}
                                className="h-8 text-sm w-40"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateItem(item.id, { status: 'JUSTIFICADO' })}
                                disabled={!item.justificativa}
                              >
                                OK
                              </Button>
                            </div>
                          )}
                          {item.status === 'JUSTIFICADO' && (
                            <span className="text-sm text-muted-foreground">{item.justificativa}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão Fechar Caixa */}
        {currentClosure && !isClosed && closureItems.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="final-check" 
                  checked={finalCheckbox}
                  onCheckedChange={(checked) => setFinalCheckbox(checked as boolean)}
                />
                <Label htmlFor="final-check" className="text-sm">
                  Revi todos os códigos, conferi os valores em dinheiro no envelope e os valores de Pix e cartão nos seus respectivos extratos; está tudo correto.
                </Label>
              </div>
              <Button 
                onClick={handleCloseClosure}
                disabled={!finalCheckbox}
                className="w-full"
                size="lg"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Fechar Caixa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog ZPL */}
        <Dialog open={zplDialogOpen} onOpenChange={setZplDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Etiqueta do Envelope Gerada</DialogTitle>
              <DialogDescription>
                Copie o código ZPL abaixo ou faça download para imprimir na impressora Zebra
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea 
                value={zplContent} 
                readOnly 
                className="font-mono text-xs h-64"
              />
              <div className="flex gap-2 flex-wrap">
                {webUSBSupported && printer?.connected && (
                  <Button onClick={() => handleDirectPrint(zplContent)} className="bg-green-600 hover:bg-green-700">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Direto
                  </Button>
                )}
                {webUSBSupported && !printer?.connected && (
                  <Button variant="outline" onClick={handleConnectPrinter} disabled={printerConnecting}>
                    <Printer className="h-4 w-4 mr-2" />
                    {printerConnecting ? 'Conectando...' : 'Conectar Zebra'}
                  </Button>
                )}
                <Button onClick={() => downloadZplFile(zplContent, `envelope-${currentClosure?.id}.zpl`)}>
                  Download .zpl
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(zplContent);
                    toast({ title: 'Copiado!', description: 'Código ZPL copiado para a área de transferência' });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Confirmação de Período */}
        <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Período Diferente Detectado</DialogTitle>
              <DialogDescription>
                O arquivo contém período de <strong>{detectedPeriod?.start}</strong> a <strong>{detectedPeriod?.end}</strong>.
                <br />A tela está configurada para <strong>{periodStart}</strong> a <strong>{periodEnd}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={handleKeepScreenPeriod}>
                Manter período da tela
              </Button>
              <Button onClick={handleConfirmFilePeriod}>
                Usar período do arquivo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
