import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Download, Copy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface EnvelopeLabelPreviewProps {
  envelopeId: string;
  unitName: string;
  unitCode: string;
  countedCash: number;
  lisCodesCount: number;
  closedByName: string;
  createdAt: string;
  lisCodes: string[];
  labelAlreadyPrinted: boolean;
  onPrintLabel: () => void;
  onDownloadZpl: () => void;
}

export function EnvelopeLabelPreview({
  envelopeId,
  unitName,
  unitCode,
  countedCash,
  lisCodesCount,
  closedByName,
  createdAt,
  lisCodes,
  labelAlreadyPrinted,
  onPrintLabel,
  onDownloadZpl,
}: EnvelopeLabelPreviewProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(envelopeId);
    toast.success('ID do envelope copiado!');
  };

  // Mostrar primeiros 5 códigos
  const displayCodes = lisCodes.slice(0, 5);
  const remainingCount = lisCodes.length - 5;

  return (
    <div className="space-y-4">
      {/* Preview da etiqueta */}
      <Card className="border-2 border-dashed">
        <CardHeader className="bg-muted/50 pb-2">
          <CardTitle className="text-center text-lg">ENVELOPE DE DINHEIRO</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">ID</p>
              <p className="font-mono font-semibold flex items-center gap-1">
                {envelopeId.substring(0, 8)}...
                <button onClick={handleCopyId} className="text-primary hover:text-primary/80">
                  <Copy className="h-3 w-3" />
                </button>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unidade</p>
              <p className="font-semibold">{unitName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Data/Hora</p>
              <p className="font-semibold">{formatDateTime(createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Responsável</p>
              <p className="font-semibold truncate">{closedByName}</p>
            </div>
          </div>

          <div className="p-3 bg-primary/10 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(countedCash)}</p>
          </div>

          <div className="text-sm">
            <p className="text-muted-foreground mb-1">Códigos LIS ({lisCodesCount})</p>
            <p className="font-mono text-xs">
              {displayCodes.join(', ')}
              {remainingCount > 0 && <span className="text-muted-foreground"> +{remainingCount} mais</span>}
            </p>
          </div>

          {/* Código de barras simulado */}
          <div className="flex flex-col items-center pt-2 border-t">
            <div className="w-full h-10 bg-gradient-to-r from-black via-white to-black bg-[length:4px_100%] mb-1" />
            <p className="text-xs font-mono text-muted-foreground">{envelopeId.substring(0, 20)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Botões de ação */}
      <div className="flex gap-3">
        <Button 
          onClick={onPrintLabel} 
          className="flex-1"
          variant={labelAlreadyPrinted ? 'outline' : 'default'}
        >
          {labelAlreadyPrinted ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Reimprimir (CÓPIA)
            </>
          ) : (
            <>
              <Printer className="h-4 w-4 mr-2" />
              Emitir Etiqueta
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onDownloadZpl}>
          <Download className="h-4 w-4 mr-2" />
          Baixar ZPL
        </Button>
      </div>

      {labelAlreadyPrinted && (
        <p className="text-sm text-center text-muted-foreground">
          ⚠️ Etiqueta já impressa anteriormente. Reimprimir marcará como CÓPIA.
        </p>
      )}
    </div>
  );
}
