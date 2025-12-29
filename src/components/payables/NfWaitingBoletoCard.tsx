import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, FileText, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formats';
import { differenceInDays } from 'date-fns';

interface NfAguardando {
  id: string;
  document_number: string;
  supplier_name: string;
  total_value: number;
  issue_date: string;
  created_at: string;
  diasAguardando: number;
}

interface NfWaitingBoletoCardProps {
  onAddBoleto?: (nfId: string) => void;
}

export function NfWaitingBoletoCard({ onAddBoleto }: NfWaitingBoletoCardProps) {
  const { data: nfsAguardando = [], isLoading } = useQuery({
    queryKey: ['nfs-aguardando-boleto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, document_number, supplier_name, total_value, issue_date, created_at')
        .eq('status', 'aguardando_boleto')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const hoje = new Date();
      return (data || []).map(nf => ({
        ...nf,
        diasAguardando: differenceInDays(hoje, new Date(nf.created_at)),
      })) as NfAguardando[];
    },
  });

  const critico = nfsAguardando.filter(nf => nf.diasAguardando > 14);
  const alerta = nfsAguardando.filter(nf => nf.diasAguardando >= 7 && nf.diasAguardando <= 14);
  const normal = nfsAguardando.filter(nf => nf.diasAguardando < 7);

  const getUrgencyBadge = (dias: number) => {
    if (dias > 14) {
      return <Badge variant="destructive">Crítico - {dias} dias</Badge>;
    }
    if (dias >= 7) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">{dias} dias</Badge>;
    }
    return <Badge variant="secondary">{dias} dias</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            NFs Aguardando Boleto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (nfsAguardando.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            NFs Aguardando Boleto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Nenhuma NF aguardando boleto no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          NFs Aguardando Boleto
          <Badge variant="outline" className="ml-auto">
            {nfsAguardando.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
            <div className="text-2xl font-bold text-destructive">{critico.length}</div>
            <div className="text-xs text-muted-foreground">&gt;14 dias</div>
          </div>
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <div className="text-2xl font-bold text-amber-600">{alerta.length}</div>
            <div className="text-xs text-muted-foreground">7-14 dias</div>
          </div>
          <div className="p-2 rounded bg-muted">
            <div className="text-2xl font-bold">{normal.length}</div>
            <div className="text-xs text-muted-foreground">&lt;7 dias</div>
          </div>
        </div>

        {/* Critical items first */}
        {critico.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              Crítico
            </div>
            {critico.slice(0, 3).map(nf => (
              <NfItem key={nf.id} nf={nf} onAddBoleto={onAddBoleto} getUrgencyBadge={getUrgencyBadge} />
            ))}
          </div>
        )}

        {/* Alert items */}
        {alerta.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <Clock className="h-4 w-4" />
              Alerta
            </div>
            {alerta.slice(0, 3).map(nf => (
              <NfItem key={nf.id} nf={nf} onAddBoleto={onAddBoleto} getUrgencyBadge={getUrgencyBadge} />
            ))}
          </div>
        )}

        {/* Normal items */}
        {normal.length > 0 && critico.length === 0 && alerta.length === 0 && (
          <div className="space-y-2">
            {normal.slice(0, 5).map(nf => (
              <NfItem key={nf.id} nf={nf} onAddBoleto={onAddBoleto} getUrgencyBadge={getUrgencyBadge} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NfItemProps {
  nf: NfAguardando;
  onAddBoleto?: (nfId: string) => void;
  getUrgencyBadge: (dias: number) => React.ReactNode;
}

function NfItem({ nf, onAddBoleto, getUrgencyBadge }: NfItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{nf.supplier_name}</div>
          <div className="text-xs text-muted-foreground">
            NF {nf.document_number} • {formatCurrency(nf.total_value)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {getUrgencyBadge(nf.diasAguardando)}
        {onAddBoleto && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddBoleto(nf.id)}
            title="Cadastrar boleto"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
