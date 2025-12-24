import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Printer,
  Banknote,
  Calculator,
} from 'lucide-react';
import { generateClosingZpl, generateEnvelopeId, downloadZplFile, ZplClosingData } from '@/utils/zpl';

interface LisClosureForCash {
  id: string;
  period_start: string;
  period_end: string;
  total_dinheiro: number;
  total_pix: number;
  total_cartao_liquido: number;
  status: string;
  unit_id: string;
}

type ClosingStep = 'loading' | 'no_lis' | 'input' | 'result' | 'success';

export default function CashClosingSimplePage() {
  const navigate = useNavigate();
  const { user, profile, unit: userUnit, isAdmin, isLoading: authLoading } = useAuth();
  
  const [step, setStep] = useState<ClosingStep>('loading');
  const [lisData, setLisData] = useState<LisClosureForCash | null>(null);
  const [countedCash, setCountedCash] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingClosing, setExistingClosing] = useState<any>(null);
  
  // ZPL Dialog
  const [zplDialogOpen, setZplDialogOpen] = useState(false);
  const [lastClosing, setLastClosing] = useState<{ zpl: string; envelopeId: string } | null>(null);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => 
    format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }), 
  []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && userUnit) {
      fetchTodayLisData();
    } else if (user && !userUnit && !authLoading) {
      // User without unit - show error
      setStep('no_lis');
    }
  }, [user, userUnit, authLoading]);

  const fetchTodayLisData = async () => {
    if (!userUnit) return;
    
    setStep('loading');
    try {
      // Find LIS closure for today and this unit
      const { data: lisClosures, error: lisError } = await supabase
        .from('lis_closures')
        .select('id, period_start, period_end, total_dinheiro, total_pix, total_cartao_liquido, status, unit_id')
        .eq('unit_id', userUnit.id)
        .gte('period_end', today)
        .lte('period_start', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lisError) throw lisError;

      if (!lisClosures || lisClosures.length === 0) {
        setStep('no_lis');
        return;
      }

      const lis = lisClosures[0] as LisClosureForCash;
      setLisData(lis);

      // Check if there's already a closing for today
      const { data: existing } = await supabase
        .from('daily_cash_closings')
        .select('*')
        .eq('unit_id', userUnit.id)
        .eq('date', today)
        .single();

      if (existing) {
        setExistingClosing(existing);
        if (existing.status === 'FECHADO' || existing.status === 'CONFERIDO') {
          setStep('success');
        } else {
          setCountedCash(existing.counted_cash?.toString() || '');
          setStep('input');
        }
      } else {
        setStep('input');
      }
    } catch (error) {
      console.error('Error fetching LIS data:', error);
      toast.error('Erro ao carregar dados do LIS');
      setStep('no_lis');
    }
  };

  const handleCheck = () => {
    const counted = parseFloat(countedCash.replace(',', '.'));
    if (isNaN(counted) || counted < 0) {
      toast.error('Informe um valor válido');
      return;
    }
    setStep('result');
  };

  const difference = useMemo(() => {
    if (!lisData) return 0;
    const counted = parseFloat(countedCash.replace(',', '.')) || 0;
    return counted - Number(lisData.total_dinheiro);
  }, [countedCash, lisData]);

  const hasDifference = Math.abs(difference) > 0.01;

  const handleConfirm = async (withDifference: boolean = false) => {
    if (!user || !lisData || !userUnit) return;
    
    if (withDifference && !justification.trim()) {
      toast.error('Informe uma justificativa para a diferença');
      return;
    }

    setIsSubmitting(true);
    try {
      const counted = parseFloat(countedCash.replace(',', '.'));
      const status = hasDifference ? 'CONFERIDO_COM_DIFERENCA' : 'CONFERIDO';
      
      // Generate envelope ID
      const { count } = await supabase
        .from('daily_cash_closings')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', userUnit.id)
        .gte('date', today);

      const sequence = (count || 0) + 1;
      const envelopeId = generateEnvelopeId(userUnit.code || 'UNIT', today, sequence);

      // Insert or update daily_cash_closing
      const closingData = {
        lis_closure_id: lisData.id,
        unit_id: userUnit.id,
        date: today,
        expected_cash: lisData.total_dinheiro,
        counted_cash: counted,
        status,
        counted_by: user.id,
        counted_at: new Date().toISOString(),
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        notes: justification || null,
        envelope_id: envelopeId,
      };

      if (existingClosing) {
        const { error } = await supabase
          .from('daily_cash_closings')
          .update(closingData)
          .eq('id', existingClosing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_cash_closings')
          .insert(closingData);
        if (error) throw error;
      }

      // Generate ZPL label
      const zplData: ZplClosingData = {
        unitName: userUnit.name || 'Unidade',
        unitCode: userUnit.code || 'UNIT',
        date: format(new Date(), 'dd/MM/yyyy'),
        actualBalance: counted,
        envelopeId: envelopeId,
        closedByName: profile?.name || 'Usuário',
      };

      const zplContent = generateClosingZpl(zplData);
      setLastClosing({ zpl: zplContent, envelopeId });
      setZplDialogOpen(true);
      
      setStep('success');
      toast.success('Fechamento de caixa registrado!');
    } catch (error) {
      console.error('Error confirming closing:', error);
      toast.error('Erro ao confirmar fechamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadZpl = () => {
    if (lastClosing) {
      downloadZplFile(lastClosing.zpl, `etiqueta-${lastClosing.envelopeId}.zpl`);
    }
  };

  const resetForm = () => {
    setCountedCash('');
    setJustification('');
    setStep('input');
  };

  if (authLoading || step === 'loading') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando movimento do dia...</p>
        </div>
      </AppLayout>
    );
  }

  // No LIS data - blocking message
  if (step === 'no_lis') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Movimento LIS não encontrado
                </h2>
                <p className="text-muted-foreground">
                  Ainda não existe movimento do LIS importado para hoje 
                  {userUnit ? ` na unidade ${userUnit.name}` : ''}.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong>O que fazer?</strong><br />
                  Peça ao responsável (Financeiro ou Gestor) para importar 
                  o relatório do LIS antes de fechar o caixa.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Voltar ao Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Caixa fechado com sucesso!
                </h2>
                <p className="text-muted-foreground">
                  O fechamento de caixa de hoje já foi registrado.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => setZplDialogOpen(true)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Ver/Imprimir Etiqueta
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-start min-h-[60vh] px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Fechamento de Caixa
          </h1>
          <p className="text-muted-foreground capitalize">
            {todayFormatted}
          </p>
          {userUnit && (
            <p className="text-sm text-muted-foreground">
              Unidade: <span className="font-medium text-foreground">{userUnit.name}</span>
            </p>
          )}
        </div>

        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 pb-6 space-y-6">
            {/* LIS Info */}
            {lisData && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Dinheiro no Sistema (LIS)
                  </span>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  R$ {Number(lisData.total_dinheiro).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Input Step */}
            {step === 'input' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-lg font-medium text-foreground">
                    <Calculator className="w-5 h-5 text-muted-foreground" />
                    Quanto você contou no caixa?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={countedCash}
                      onChange={e => setCountedCash(e.target.value)}
                      className="text-3xl h-16 pl-12 text-center font-bold"
                      autoFocus
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleCheck} 
                  className="w-full h-14 text-lg"
                  disabled={!countedCash}
                >
                  Conferir Caixa
                </Button>
              </div>
            )}

            {/* Result Step */}
            {step === 'result' && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Sistema</p>
                    <p className="text-lg font-bold">
                      R$ {Number(lisData?.total_dinheiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Contado</p>
                    <p className="text-lg font-bold">
                      R$ {parseFloat(countedCash.replace(',', '.') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Result Message */}
                {!hasDifference ? (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                    <p className="text-lg font-semibold text-success">
                      Tudo certo, o caixa bateu!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Diferença: R$ 0,00
                    </p>
                  </div>
                ) : (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-3" />
                    <p className="text-lg font-semibold text-warning">
                      Atenção: O caixa não bateu!
                    </p>
                    <p className={`text-2xl font-bold mt-2 ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {difference >= 0 ? 'Sobrando' : 'Faltando'}: R$ {Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Reconte o caixa antes de confirmar.
                    </p>
                  </div>
                )}

                {/* Actions */}
                {!hasDifference ? (
                  <Button 
                    onClick={() => handleConfirm(false)} 
                    className="w-full h-14 text-lg bg-success hover:bg-success/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Fechamento
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                      className="w-full h-12"
                    >
                      Digitar outro valor
                    </Button>

                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Se tiver certeza que está correto:
                      </p>
                      <Textarea
                        placeholder="Justificativa obrigatória para diferença..."
                        value={justification}
                        onChange={e => setJustification(e.target.value)}
                        rows={2}
                      />
                      <Button 
                        variant="secondary"
                        onClick={() => handleConfirm(true)} 
                        className="w-full h-12"
                        disabled={isSubmitting || !justification.trim()}
                      >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Confirmar com diferença
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ZPL Dialog */}
      <Dialog open={zplDialogOpen} onOpenChange={setZplDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Etiqueta do Envelope
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-2">ID do Envelope:</p>
              <p className="font-mono text-lg">{lastClosing?.envelopeId}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Código ZPL para impressora Zebra:</p>
              <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto max-h-40">
                {lastClosing?.zpl}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadZpl} className="flex-1">
                <Printer className="w-4 h-4 mr-2" />
                Baixar arquivo ZPL
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  if (lastClosing?.zpl) {
                    navigator.clipboard.writeText(lastClosing.zpl);
                    toast.success('ZPL copiado!');
                  }
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Envie o arquivo para sua impressora Zebra ou cole o código no software de impressão.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}