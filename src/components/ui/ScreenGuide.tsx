import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScreenGuideProps {
  purpose: string;
  steps?: string[];
  className?: string;
  dismissible?: boolean;
  storageKey?: string;
}

export function ScreenGuide({ 
  purpose, 
  steps, 
  className,
  dismissible = true,
  storageKey,
}: ScreenGuideProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!storageKey) return false;
    return localStorage.getItem(`screen-guide-${storageKey}`) === 'dismissed';
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    if (storageKey) {
      localStorage.setItem(`screen-guide-${storageKey}`, 'dismissed');
    }
  };

  if (isDismissed) return null;

  return (
    <div 
      className={cn(
        "bg-primary/5 border border-primary/20 rounded-lg transition-all",
        className
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="p-2 rounded-full bg-primary/10 shrink-0">
          <Lightbulb className="h-4 w-4 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {purpose}
          </p>
          
          {steps && steps.length > 0 && isExpanded && (
            <ol className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {steps && steps.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
