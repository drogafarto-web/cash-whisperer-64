import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpChatModal } from './HelpChatModal';

export function HelpFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 hover:scale-105 transition-transform"
            onClick={() => setIsOpen(true)}
          >
            <HelpCircle className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Central de Ajuda</p>
        </TooltipContent>
      </Tooltip>

      <HelpChatModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
