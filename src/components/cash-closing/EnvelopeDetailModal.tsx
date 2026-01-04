import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle, Package, DollarSign, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LisClosureItem {
  id: string;
  lis_code: string;
  patient_name: string | null;
  payment_method: string;
  amount: number;
  date: string;
}

interface EnvelopeData {
  id: string;
  unit_id: string | null;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  status: string;
  lis_codes: string[];
  lis_codes_count: number;
  created_at: string;
  created_by: string | null;
  conferencia_checkbox: boolean;
  justificativa: string | null;
  unit?: {
    id: string;
    name: string;
    code: string | null;
  };
}

interface EnvelopeDetailModalProps {
  envelope: EnvelopeData | null;
  open: boolean;
  onClose: () => void;
  onConferido?: () => void;
  isAdmin?: boolean;
}

export function EnvelopeDetailModal({ 
  envelope, 
  open, 
  onClose,
  onConferido,
  isAdmin = false
}: EnvelopeDetailModalProps) {
  const [lisItems, setLisItems] = useState<LisClosureItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isConferindo, setIsConferindo] = useState(false);

  useEffect(() => {
    if (open && envelope && envelope.lis_codes && envelope.lis_codes.length > 0) {
      fetchLisItems();
    } else {
      setLisItems([]);
    }
  }, [open, envelope]);

  const fetchLisItems = async () => {
    if (!envelope) return;
    
    setIsLoadingItems(true);
    try {
      const { data } = await supabase
        .from('lis_closure_items')
        .select('id, lis_code, patient_name, payment_method, amount, date')
        .eq('envelope_id', envelope.id)
        .order('lis_code');

      setLisItems(data || []);
    } catch (error) {
      console.error('Error fetching LIS items:', error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleConferir = async () => {
    if (!envelope) return;
    
    setIsConferindo(true);
    try {
      const { error } = await supabase
        .from('cash_envelopes')
        .update({
          conferencia_checkbox: true,
          status: 'CONFERIDO'
        })
        .eq('id', envelope.id);

      if (error) throw error;

      toast.success('Envelope conferido com sucesso!');
      onConferido?.();
      onClose();
    } catch (error) {
      console.error('Error confirming envelope:', error);
      toast.error('Erro ao conferir envelope');
    } finally {
      setIsConferindo(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      DINHEIRO: 'Dinheiro',
      PIX: 'PIX',
      CARTAO_CREDITO: 'Cartão Crédito',
      CARTAO_DEBITO: 'Cartão Débito',
      CONVENIO: 'Convênio',
    };
    return labels[method] || method;
  };

  if (!envelope) return null;

  const isConferido = envelope.status === 'CONFERIDO' || envelope.conferencia_checkbox;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Envelope
            {isConferido && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conferido
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Envelope Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data/Hora</p>
                <p className="font-medium text-sm">
                  {format(parseISO(envelope.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Unidade</p>
                <p className="font-medium text-sm">{envelope.unit?.code || envelope.unit?.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Esperado</p>
                <p className="font-medium text-sm">{formatCurrency(envelope.expected_cash || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Contado</p>
                <p className="font-medium text-sm">{formatCurrency(envelope.counted_cash || 0)}</p>
              </div>
            </div>
          </div>

          {/* Difference highlight */}
          <div className={cn(
            "p-4 rounded-lg border",
            envelope.difference === 0 
              ? "bg-green-500/5 border-green-500/20" 
              : envelope.difference && envelope.difference < 0 
                ? "bg-destructive/5 border-destructive/20" 
                : "bg-yellow-500/5 border-yellow-500/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Diferença</span>
              <span className={cn(
                "text-xl font-bold",
                envelope.difference === 0 
                  ? "text-green-600" 
                  : envelope.difference && envelope.difference < 0 
                    ? "text-destructive" 
                    : "text-yellow-600"
              )}>
                {formatCurrency(envelope.difference || 0)}
              </span>
            </div>
            {envelope.justificativa && (
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Justificativa:</strong> {envelope.justificativa}
              </p>
            )}
          </div>

          {/* LIS Codes Table */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              Códigos LIS ({envelope.lis_codes_count || envelope.lis_codes?.length || 0})
            </h4>
            
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lisItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lisItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.lis_code}</TableCell>
                        <TableCell>{item.patient_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getPaymentMethodLabel(item.payment_method)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : envelope.lis_codes && envelope.lis_codes.length > 0 ? (
              <div className="border rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {envelope.lis_codes.map((code, idx) => (
                    <Badge key={idx} variant="secondary" className="font-mono">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum código LIS associado a este envelope.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {isAdmin && !isConferido && (
            <Button 
              onClick={handleConferir} 
              disabled={isConferindo}
              className="bg-green-600 hover:bg-green-700"
            >
              {isConferindo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Conferir Envelope
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
