import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import type { PayrollOcrResult } from '@/services/accountingValidationService';

interface PayrollAnalysisCardProps {
  result: PayrollOcrResult;
  fileName: string;
  status: 'processing' | 'ready' | 'applied' | 'error';
  onApply?: () => void;
  onRemove?: () => void;
}

export function PayrollAnalysisCard({
  result,
  fileName,
  status,
  onApply,
  onRemove,
}: PayrollAnalysisCardProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-blue-500" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon and Type */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Folha de Pagamento</span>
                {status === 'processing' && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analisando
                  </Badge>
                )}
                {status === 'ready' && (
                  <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                    <FileSpreadsheet className="h-3 w-3" />
                    Pronto
                  </Badge>
                )}
                {status === 'applied' && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Aplicado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {fileName}
              </p>
            </div>
          </div>

          {/* Right: Funcionários */}
          <div className="text-right">
            {result.num_funcionarios !== null && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {result.num_funcionarios} funcionário(s)
              </Badge>
            )}
          </div>
        </div>

        {/* Values Grid */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Folha</p>
            <p className="font-semibold">{formatCurrency(result.total_folha)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Encargos</p>
            <p className="font-semibold">{formatCurrency(result.encargos)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Pró-labore</p>
            <p className="font-semibold">{formatCurrency(result.prolabore)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Competência</p>
            <p className="font-semibold">
              {result.competencia 
                ? `${result.competencia.mes.toString().padStart(2, '0')}/${result.competencia.ano}`
                : '—'}
            </p>
          </div>
        </div>

        {/* Confidence */}
        <div className={`mt-2 text-xs ${getConfidenceColor(result.confidence)}`}>
          Confiança da análise: {Math.round(result.confidence * 100)}%
        </div>

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
