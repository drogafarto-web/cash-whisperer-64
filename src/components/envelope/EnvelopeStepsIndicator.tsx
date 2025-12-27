import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EnvelopeStep = 'selection' | 'comparison' | 'success';

interface EnvelopeStepsIndicatorProps {
  currentStep: EnvelopeStep;
}

const STEPS = [
  { key: 'selection', label: 'Selecionar' },
  { key: 'comparison', label: 'Contar' },
  { key: 'success', label: 'Confirmar' },
] as const;

function getStepIndex(step: EnvelopeStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export function EnvelopeStepsIndicator({ currentStep }: EnvelopeStepsIndicatorProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1',
                  isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  index < currentIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
