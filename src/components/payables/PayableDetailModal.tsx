import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Check, Download, ExternalLink } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import type { Payable } from '@/types/payables';

interface PayableDetailModalProps {
  payable: Payable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsPaid?: (payable: Payable) => void;
}

export function PayableDetailModal({
  payable,
  open,
  onOpenChange,
  onMarkAsPaid,
}: PayableDetailModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    if (payable?.file_path && open) {
      loadPdfUrl(payable.file_path);
    } else {
      setPdfUrl(null);
    }
  }, [payable?.file_path, open]);

  const loadPdfUrl = async (filePath: string) => {
    setLoadingPdf(true);
    try {
      const { data, error } = await supabase.storage
        .from('payables')
        .createSignedUrl(filePath, 3600);
      
      if (error) throw error;
      setPdfUrl(data.signedUrl);
    } catch (err) {
      console.error('Erro ao carregar PDF:', err);
      setPdfUrl(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  if (!payable) return null;

  const isOverdue = payable.status === 'pendente' && new Date(payable.vencimento) < new Date();

  const getStatusBadge = () => {
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pendente: 'secondary',
      pago: 'outline',
      cancelado: 'destructive',
    };
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      pago: 'Pago',
      cancelado: 'Cancelado',
    };
    return <Badge variant={variants[payable.status] || 'secondary'}>{labels[payable.status] || payable.status}</Badge>;
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '-'}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Boleto</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-1">{payable.beneficiario || 'Beneficiário não informado'}</h3>
            <p className="text-2xl font-bold text-primary">
              {payable.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>

          {/* Basic Info */}
          <div className="divide-y">
            <InfoRow 
              label="Vencimento" 
              value={format(new Date(payable.vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} 
            />
            {payable.parcela_numero && payable.parcela_total && (
              <InfoRow 
                label="Parcela" 
                value={`${payable.parcela_numero} de ${payable.parcela_total}`} 
              />
            )}
            {payable.beneficiario_cnpj && (
              <InfoRow label="CNPJ" value={payable.beneficiario_cnpj} />
            )}
            {payable.banco_nome && (
              <InfoRow 
                label="Banco" 
                value={`${payable.banco_nome}${payable.banco_codigo ? ` (${payable.banco_codigo})` : ''}`} 
              />
            )}
            {payable.description && (
              <InfoRow label="Descrição" value={payable.description} />
            )}
          </div>

          {/* Linha Digitável */}
          {payable.linha_digitavel && (
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Linha digitável</label>
              <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                {payable.linha_digitavel}
              </div>
            </div>
          )}

          {/* Payment Info (if paid) */}
          {payable.status === 'pago' && payable.paid_at && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-green-600 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Pagamento Realizado
                </h4>
                <div className="divide-y">
                  <InfoRow 
                    label="Data do pagamento" 
                    value={format(new Date(payable.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
                  />
                  {payable.paid_amount && (
                    <InfoRow 
                      label="Valor pago" 
                      value={payable.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                    />
                  )}
                  {payable.paid_method && (
                    <InfoRow label="Método" value={payable.paid_method} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* PDF Viewer */}
          {payable.file_path && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documento Anexo
                  </h4>
                  {pdfUrl && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={pdfUrl} download={payable.file_name || 'boleto.pdf'}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                
                {loadingPdf ? (
                  <div className="h-96 flex items-center justify-center bg-muted rounded-md">
                    <span className="text-muted-foreground">Carregando documento...</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-96 rounded-md border"
                    title="Visualização do boleto"
                  />
                ) : (
                  <div className="h-32 flex items-center justify-center bg-muted rounded-md">
                    <span className="text-muted-foreground">Não foi possível carregar o documento</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {payable.status === 'pendente' && onMarkAsPaid && (
            <Button onClick={() => onMarkAsPaid(payable)} className="gap-2">
              <Check className="h-4 w-4" />
              Marcar como Pago
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
