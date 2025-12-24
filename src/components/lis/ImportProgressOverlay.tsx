import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2 } from 'lucide-react';

export interface ImportStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done';
}

interface ImportProgressOverlayProps {
  isVisible: boolean;
  steps: ImportStep[];
  currentStep: number;
  totalRecords?: number;
  processedRecords?: number;
  skippedRecords?: number;
}

export function ImportProgressOverlay({
  isVisible,
  steps,
  currentStep,
  totalRecords = 0,
  processedRecords = 0,
  skippedRecords = 0,
}: ImportProgressOverlayProps) {
  if (!isVisible) return null;

  const progress = steps.length > 0 ? (currentStep / steps.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-xl shadow-lg p-6 w-full max-w-md mx-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Importando Arquivo LIS</h3>
            <p className="text-sm text-muted-foreground">Aguarde enquanto processamos...</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            {Math.round(progress)}% concluído
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                step.status === 'running'
                  ? 'bg-primary/10'
                  : step.status === 'done'
                  ? 'bg-muted/50'
                  : ''
              }`}
            >
              {step.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : step.status === 'running' ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  step.status === 'running'
                    ? 'font-medium text-foreground'
                    : step.status === 'done'
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Records info */}
        {totalRecords > 0 && (
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <span className="font-medium text-foreground">{processedRecords}</span> de{' '}
            <span className="font-medium text-foreground">{totalRecords}</span> registros
            {skippedRecords > 0 && (
              <span className="text-yellow-600 ml-2">
                ({skippedRecords} duplicados ignorados)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
