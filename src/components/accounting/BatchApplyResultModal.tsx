import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Receipt,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export interface BatchResultItem {
  type: string;
  valor: number;
  status: 'success' | 'duplicate' | 'error';
  fileName: string;
  errorMessage?: string;
  payableSkipped?: boolean;
}

export interface BatchApplyResult {
  applied: BatchResultItem[];
  totalApplied: number;
  payablesCreated: number;
  payablesSkipped?: number;
  duplicatesFound: number;
  errorsCount: number;
}

interface BatchApplyResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: BatchApplyResult | null;
}

export function BatchApplyResultModal({
  open,
  onOpenChange,
  result,
}: BatchApplyResultModalProps) {
  const navigate = useNavigate();
  
  if (!result) return null;
  
  const successCount = result.applied.filter(r => r.status === 'success').length;
  
  const getStatusIcon = (item: BatchResultItem) => {
    if (item.payableSkipped) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    switch (item.status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'duplicate':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };
  
  const getStatusBadge = (item: BatchResultItem) => {
    if (item.payableSkipped) {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">
          Só painel
        </Badge>
      );
    }
    switch (item.status) {
      case 'success':
        return <Badge className="bg-green-600">Aplicado</Badge>;
      case 'duplicate':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Duplicado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const handleViewPayables = () => {
    onOpenChange(false);
    navigate('/payables/tax-documents');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Resumo da Aplicação em Lote
          </DialogTitle>
          <DialogDescription>
            Resultado do processamento de {result.applied.length} documento(s)
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xl font-bold">{successCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Aplicados</p>
          </div>
          
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <FileText className="h-4 w-4" />
              <span className="text-xl font-bold">{result.payablesCreated}</span>
            </div>
            <p className="text-xs text-muted-foreground">Contas Criadas</p>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(result.totalApplied)}
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        
        {/* Critical Warning for Skipped Payables */}
        {(result.payablesSkipped ?? 0) > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  {result.payablesSkipped} documento(s) sem conta a pagar
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-500 mt-1">
                  Os valores foram aplicados ao painel contábil, mas as contas a pagar não foram criadas 
                  porque os arquivos não foram salvos corretamente. Considere reenviar estes documentos.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Other Warnings */}
        {(result.duplicatesFound > 0 || result.errorsCount > 0) && (
          <div className="flex gap-2 flex-wrap">
            {result.duplicatesFound > 0 && (
              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {result.duplicatesFound} duplicado(s)
              </Badge>
            )}
            {result.errorsCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {result.errorsCount} erro(s)
              </Badge>
            )}
          </div>
        )}
        
        {/* Details List */}
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {result.applied.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getStatusIcon(item)}
                  <div className="min-w-0">
                    <span className="font-medium">{item.type.toUpperCase()}</span>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {item.fileName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium whitespace-nowrap">
                    {formatCurrency(item.valor)}
                  </span>
                  {getStatusBadge(item)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {result.payablesCreated > 0 && (
            <Button variant="outline" onClick={handleViewPayables} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver Documentos Tributários
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
