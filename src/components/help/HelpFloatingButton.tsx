import { useState, useEffect } from 'react';
import { HelpCircle, MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpChatModal } from './HelpChatModal';
import { cn } from '@/lib/utils';

export function HelpFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(true);

  // Para de pulsar após 10 segundos
  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className={cn(
              "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-[9999] hover:scale-110 transition-all duration-300",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "border-2 border-primary-foreground/20",
              pulse && "animate-pulse ring-4 ring-primary/30"
            )}
            onClick={() => {
              setIsOpen(true);
              setPulse(false);
            }}
            aria-label="Abrir Central de Ajuda"
          >
            <MessageCircleQuestion className="h-7 w-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-sm font-medium">
          <p>Precisa de ajuda? Pergunte à IA</p>
        </TooltipContent>
      </Tooltip>

      <HelpChatModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
