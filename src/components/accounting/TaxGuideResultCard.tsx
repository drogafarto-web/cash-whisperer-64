import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileCheck2,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  Receipt,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { TaxGuideOcrResult } from '@/services/accountingValidationService';

const TAX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  das: { label: 'DAS', color: 'bg-blue-500', icon: <Receipt className="h-4 w-4" /> },
  darf: { label: 'DARF', color: 'bg-purple-500', icon: <Receipt className="h-4 w-4" /> },
  gps: { label: 'GPS', color: 'bg-orange-500', icon: <Receipt className="h-4 w-4" /> },
  inss: { label: 'INSS', color: 'bg-teal-500', icon: <Receipt className="h-4 w-4" /> },
  fgts: { label: 'FGTS', color: 'bg-green-500', icon: <Receipt className="h-4 w-4" /> },
  iss: { label: 'ISS', color: 'bg-red-500', icon: <Receipt className="h-4 w-4" /> },
  outro: { label: 'Documento', color: 'bg-gray-500', icon: <FileCheck2 className="h-4 w-4" /> },
};

interface TaxGuideResultCardProps {
  result: TaxGuideOcrResult;
  fileName: string;
  status: 'processing' | 'ready' | 'applied' | 'error';
  onApply?: () => void;
  onCreatePayable?: () => void;
  isCreatingPayable?: boolean;
  onRemove?: () => void;
}

export function TaxGuideResultCard({
  result,
  fileName,
  status,
  onApply,
  onCreatePayable,
  isCreatingPayable,
  onRemove,
}: TaxGuideResultCardProps) {
  const config = TAX_TYPE_CONFIG[result.tipo_documento] || TAX_TYPE_CONFIG.outro;

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${config.color}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon and Type */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color} text-white`}>
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{config.label}</span>
                {status === 'processing' && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processando
                  </Badge>
                )}
                {status === 'ready' && (
                  <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                    <FileCheck2 className="h-3 w-3" />
                    Pronto
                  </Badge>
                )}
                {status === 'applied' && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Aplicado
                  </Badge>
                )}
                {status === 'error' && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Erro
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {fileName}
              </p>
            </div>
          </div>

          {/* Right: Value and Due Date */}
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(result.valor)}</p>
            {result.vencimento && (
              <p className="text-xs text-muted-foreground">
                Venc: {formatDate(result.vencimento)}
              </p>
            )}
          </div>
        </div>

        {/* Additional Info */}
        {(result.competencia || result.cnpj_contribuinte) && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
            {result.competencia && (
              <div>
                <span className="font-medium">Competência:</span>{' '}
                {result.competencia.mes.toString().padStart(2, '0')}/{result.competencia.ano}
              </div>
            )}
            {result.cnpj_contribuinte && (
              <div>
                <span className="font-medium">CNPJ:</span> {result.cnpj_contribuinte}
              </div>
            )}
            <div className={getConfidenceColor(result.confidence)}>
              <span className="font-medium">Confiança:</span> {Math.round(result.confidence * 100)}%
            </div>
          </div>
        )}

        {/* Alerts */}
        {result.alertas && result.alertas.length > 0 && (
          <div className="mt-3 space-y-1">
            {result.alertas.map((alerta, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-800 dark:text-yellow-200"
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{alerta}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI Suggestion */}
        {result.sugestao && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-primary/5 rounded-lg">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-primary">Sugestão da IA</p>
              <p className="text-xs text-muted-foreground">{result.sugestao}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {status === 'ready' && (
          <div className="mt-3 flex justify-end gap-2">
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                Remover
              </Button>
            )}
            {onCreatePayable && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCreatePayable}
                disabled={isCreatingPayable}
                className="gap-1"
              >
                {isCreatingPayable ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Criar Conta a Pagar
              </Button>
            )}
            {onApply && (
              <Button size="sm" onClick={onApply} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Aplicar Valores
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
