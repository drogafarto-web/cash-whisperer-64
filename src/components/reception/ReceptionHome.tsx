import { useState } from 'react';
import { FileUp, Wallet, Sparkles, ArrowRight, BarChart3, ChevronRight, Clock, AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReceptionDaySummaryModal } from './ReceptionDaySummaryModal';

export type ReceptionStep = 'home' | 'import' | 'document-upload';

interface ReceptionHomeProps {
  onNavigate: (step: ReceptionStep) => void;
  onCheckEnvelope: () => void;
  unitId: string | null;
}

export function ReceptionHome({ onNavigate, onCheckEnvelope, unitId }: ReceptionHomeProps) {
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  // Hooks PRIMEIRO - antes de qualquer return condicional
  const { data: dayData } = useQuery({
    queryKey: ['reception-day-data', unitId, today],
    queryFn: async () => {
      if (!unitId) return { lastImport: null, processed: 0, pending: 0 };
      
      const { data: items } = await supabase
        .from('lis_closure_items')
        .select('id, envelope_id, created_at')
        .eq('unit_id', unitId)
        .gte('date', today)
        .order('created_at', { ascending: false });
      
      const lastImport = items?.[0] ? { created_at: items[0].created_at } : null;
      const processed = items?.filter(i => i.envelope_id)?.length || 0;
      const pending = items?.filter(i => !i.envelope_id)?.length || 0;
      
      return { lastImport, processed, pending };
    },
    enabled: !!unitId,
    staleTime: 30000,
  });

  const { data: pendingEnvelope } = useQuery({
    queryKey: ['reception-pending-envelope', unitId],
    queryFn: async () => {
      if (!unitId) return null;
      const { data } = await supabase
        .from('cash_envelopes')
        .select('id, lis_codes_count')
        .eq('unit_id', unitId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!unitId,
    staleTime: 30000,
  });

  const lastImport = dayData?.lastImport;
  const dayCounts = dayData ? { processed: dayData.processed, pending: dayData.pending } : null;

  // AGORA podemos fazer o return condicional (após todos os hooks)
  if (!unitId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Nenhuma Unidade Selecionada
              </h2>
              <p className="text-muted-foreground">
                Você precisa estar vinculado a uma unidade para acessar o Painel de Recepção.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">O que fazer?</p>
                  <p className="text-sm text-muted-foreground">
                    Entre em contato com o administrador do sistema para vincular seu usuário a uma unidade.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const importCompleted = !!lastImport;
  const importTime = lastImport?.created_at 
    ? format(new Date(lastImport.created_at), 'HH:mm')
    : null;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-5 lg:gap-6 lg:space-y-0">
      {/* Card Principal - Processamento Inteligente */}
      <Card 
        className="bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 border-0 p-6 lg:p-8 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.01] lg:col-span-3 lg:row-span-2 lg:flex lg:flex-col lg:justify-between lg:min-h-[280px]"
        onClick={() => onNavigate('document-upload')}
      >
        <div>
          <div className="flex items-center gap-2 text-sm opacity-90 uppercase tracking-wide">
            <Sparkles className="h-4 w-4 lg:h-5 lg:w-5" />
            <span className="font-medium">Processamento Inteligente</span>
          </div>
          
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold mt-4 lg:mt-6 leading-tight">
            Arraste ou clique para processar magicamente
          </h2>
          
          <p className="text-white/70 mt-2 lg:mt-3 text-sm lg:text-base">
            Análise automática de guias e documentos
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-6 lg:mt-8">
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
              AI
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
              PDF
            </Badge>
          </div>
          <Button 
            variant="secondary" 
            className="bg-white text-violet-700 hover:bg-white/90 font-semibold lg:text-base lg:px-6"
          >
            Processar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>

      {/* Coluna lateral com cards de status - empilhados verticalmente em desktop */}
      <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-1 lg:gap-4 lg:row-span-2">
        {/* Card Guias do Dia */}
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50 lg:flex lg:items-center lg:gap-4"
          onClick={() => onNavigate('import')}
        >
          <div className="flex items-start justify-between lg:flex-col lg:items-start lg:gap-2 lg:flex-1">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${importCompleted ? 'bg-green-100' : 'bg-orange-100'}`}>
                <FileUp className={`h-5 w-5 ${importCompleted ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <div className="hidden lg:block">
                <p className="text-xs text-muted-foreground">Importação</p>
                <p className="font-semibold text-foreground">Guias do Dia</p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-xs font-medium ${
                importCompleted 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-100'
              }`}
            >
              {importCompleted ? 'CONCLUÍDO' : 'PENDENTE'}
            </Badge>
          </div>
          
          <div className="lg:hidden">
            <p className="text-xs text-muted-foreground mt-3">Importação</p>
            <p className="font-semibold text-foreground">Guias do Dia</p>
          </div>
          
          {importCompleted && importTime && (
            <p className="text-xs text-green-600 flex items-center mt-2 lg:mt-0">
              <Clock className="h-3 w-3 mr-1" />
              {importTime}
            </p>
          )}
          
          {!importCompleted && (
            <p className="text-xs text-orange-600 mt-2 lg:mt-0">
              Aguardando importação
            </p>
          )}
        </Card>

        {/* Card Envelope */}
        <Card className="p-4 lg:flex lg:items-center lg:gap-4">
          <div className="flex items-start justify-between lg:flex-col lg:items-start lg:gap-2 lg:flex-1">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${pendingEnvelope ? 'bg-orange-100' : 'bg-muted'}`}>
                <Wallet className={`h-5 w-5 ${pendingEnvelope ? 'text-orange-600' : 'text-muted-foreground'}`} />
              </div>
              <div className="hidden lg:block">
                <p className="text-xs text-muted-foreground">Físico</p>
                <p className="font-semibold text-foreground">
                  {pendingEnvelope ? `Envelope #${pendingEnvelope.lis_codes_count || '?'}` : 'Envelope'}
                </p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-xs font-medium ${
                pendingEnvelope 
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' 
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {pendingEnvelope ? 'PENDENTE' : 'NENHUM'}
            </Badge>
          </div>
          
          <div className="lg:hidden">
            <p className="text-xs text-muted-foreground mt-3">Físico</p>
            <p className="font-semibold text-foreground">
              {pendingEnvelope ? `Envelope #${pendingEnvelope.lis_codes_count || '?'}` : 'Envelope'}
            </p>
          </div>
          
          <div className="lg:ml-auto">
            {pendingEnvelope ? (
              <Button 
                size="sm" 
                className="mt-2 w-full lg:mt-0 lg:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckEnvelope();
                }}
              >
                Conferir
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                className="mt-2 w-full lg:mt-0 lg:w-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckEnvelope();
                }}
              >
                Fechar Caixa
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Card Resumo Rápido - largura total em desktop */}
      <Card 
        className="p-4 lg:p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50 lg:col-span-5"
        onClick={() => setSummaryModalOpen(true)}
      >
        <div className="bg-primary/10 p-3 rounded-xl">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        
        <div className="flex-1">
          <p className="font-semibold text-foreground">Resumo do Dia</p>
          <div className="flex gap-6 text-sm mt-1">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {dayCounts?.processed || 0} Processados
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              {dayCounts?.pending || 0} Pendentes
            </span>
          </div>
        </div>
        
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Card>

      {/* Modal de Resumo do Dia */}
      <ReceptionDaySummaryModal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        unitId={unitId}
        date={today}
      />
    </div>
  );
}
