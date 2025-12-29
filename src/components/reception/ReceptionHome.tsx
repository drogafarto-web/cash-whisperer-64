import { FileUp, Wallet, Sparkles, ArrowRight, BarChart3, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type ReceptionStep = 'home' | 'import' | 'document-upload';

interface ReceptionHomeProps {
  onNavigate: (step: ReceptionStep) => void;
  onCheckEnvelope: () => void;
  unitId: string | null;
}

export function ReceptionHome({ onNavigate, onCheckEnvelope, unitId }: ReceptionHomeProps) {
  const today = new Date().toISOString().split('T')[0];

  // Buscar última importação do dia
  const { data: lastImport } = useQuery({
    queryKey: ['reception-last-import', unitId, today],
    queryFn: async () => {
      if (!unitId) return null;
      const { data } = await supabase
        .from('lis_closure_items')
        .select('created_at')
        .eq('unit_id', unitId)
        .gte('date', today)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!unitId,
  });

  // Buscar envelope pendente
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
  });

  // Buscar contagem de itens do dia
  const { data: dayCounts } = useQuery({
    queryKey: ['reception-day-counts', unitId, today],
    queryFn: async () => {
      if (!unitId) return { processed: 0, pending: 0 };
      
      const { data: items } = await supabase
        .from('lis_closure_items')
        .select('id, envelope_id')
        .eq('unit_id', unitId)
        .gte('date', today);
      
      const processed = items?.filter(i => i.envelope_id)?.length || 0;
      const pending = items?.filter(i => !i.envelope_id)?.length || 0;
      
      return { processed, pending };
    },
    enabled: !!unitId,
  });

  const importCompleted = !!lastImport;
  const importTime = lastImport?.created_at 
    ? format(new Date(lastImport.created_at), 'HH:mm')
    : null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Card Principal - Processamento Inteligente */}
      <Card 
        className="bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 border-0 p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
        onClick={() => onNavigate('document-upload')}
      >
        <div className="flex items-center gap-2 text-sm opacity-90 uppercase tracking-wide">
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">Processamento Inteligente</span>
        </div>
        
        <h2 className="text-2xl font-bold mt-4 leading-tight">
          Arraste ou clique para processar magicamente
        </h2>
        
        <p className="text-white/70 mt-2 text-sm">
          Análise automática de guias e documentos
        </p>
        
        <div className="flex items-center justify-between mt-6">
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
            className="bg-white text-violet-700 hover:bg-white/90 font-semibold"
          >
            Processar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>

      {/* Cards de Status - Grid 2 colunas */}
      <div className="grid grid-cols-2 gap-4">
        {/* Card Guias do Dia */}
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
          onClick={() => onNavigate('import')}
        >
          <div className="flex items-start justify-between">
            <div className={`p-2.5 rounded-xl ${importCompleted ? 'bg-green-100' : 'bg-orange-100'}`}>
              <FileUp className={`h-5 w-5 ${importCompleted ? 'text-green-600' : 'text-orange-600'}`} />
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
          
          <p className="text-xs text-muted-foreground mt-3">Importação</p>
          <p className="font-semibold text-foreground">Guias do Dia</p>
          
          {importCompleted && importTime && (
            <p className="text-xs text-green-600 flex items-center mt-2">
              <Clock className="h-3 w-3 mr-1" />
              {importTime}
            </p>
          )}
          
          {!importCompleted && (
            <p className="text-xs text-orange-600 mt-2">
              Aguardando importação
            </p>
          )}
        </Card>

        {/* Card Envelope */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className={`p-2.5 rounded-xl ${pendingEnvelope ? 'bg-orange-100' : 'bg-muted'}`}>
              <Wallet className={`h-5 w-5 ${pendingEnvelope ? 'text-orange-600' : 'text-muted-foreground'}`} />
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
          
          <p className="text-xs text-muted-foreground mt-3">Físico</p>
          <p className="font-semibold text-foreground">
            {pendingEnvelope ? `Envelope #${pendingEnvelope.lis_codes_count || '?'}` : 'Envelope'}
          </p>
          
          {pendingEnvelope ? (
            <Button 
              size="sm" 
              className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-white"
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
              className="mt-2 w-full"
              onClick={(e) => {
                e.stopPropagation();
                onCheckEnvelope();
              }}
            >
              Fechar Caixa
            </Button>
          )}
        </Card>
      </div>

      {/* Card Resumo Rápido */}
      <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50">
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
    </div>
  );
}
