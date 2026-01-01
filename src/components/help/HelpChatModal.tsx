import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader2, Bot, User, Sparkles, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Perguntas contextuais por rota
const SCREEN_QUESTIONS: Record<string, { name: string; questions: string[] }> = {
  '/reception-panel': {
    name: 'Quiosque',
    questions: [
      'Como lançar uma receita rapidamente?',
      'Como lançar uma despesa?',
      'Posso anexar documentos?',
      'Como usar o OCR para extrair dados?'
    ]
  },
  '/payables/boletos': {
    name: 'Boletos',
    questions: [
      'Como cadastrar um boleto?',
      'Como vincular boleto a nota fiscal?',
      'Por que o boleto deu erro ao salvar?',
      'Como marcar boleto como pago?'
    ]
  },
  '/payables/tax-documents': {
    name: 'Guias',
    questions: [
      'Quais guias devo enviar para contabilidade?',
      'Como fazer upload de FGTS ou GPS?',
      'O que é competência de uma guia?',
      'Por que minha guia não foi aceita?'
    ]
  },
  '/accounting-panel': {
    name: 'Contabilidade',
    questions: [
      'Como enviar documentos para contabilidade?',
      'O que é o Smart Upload?',
      'Quais documentos a contabilidade precisa?',
      'Como funciona a competência mensal?'
    ]
  },
  '/envelope-cash-closing': {
    name: 'Fechamento Envelope',
    questions: [
      'Como funciona o fechamento de envelope?',
      'O que fazer se houver diferença no caixa?',
      'Como reimprimir a etiqueta?',
      'Posso editar um envelope já fechado?'
    ]
  },
  '/pix-closing': {
    name: 'Confirmação PIX',
    questions: [
      'Como confirmar recebimentos PIX?',
      'Posso confirmar parcialmente?',
      'Por que alguns PIX não aparecem?'
    ]
  },
  '/card-closing': {
    name: 'Confirmação Cartão',
    questions: [
      'Como confirmar pagamentos em cartão?',
      'Como são calculadas as taxas?',
      'Onde vejo os valores líquidos?'
    ]
  },
  '/billing/invoices': {
    name: 'Faturamento',
    questions: [
      'Como cadastrar uma fatura de convênio?',
      'Como usar OCR para extrair dados?',
      'Como acompanhar pagamentos de convênios?'
    ]
  },
  '/transactions': {
    name: 'Transações',
    questions: [
      'Como filtrar transações por período?',
      'Como categorizar uma transação?',
      'O que são transações informais?'
    ]
  }
};

// Perguntas padrão quando não há contexto específico
const DEFAULT_QUESTIONS = [
  'Como faço upload de uma guia FGTS?',
  'O que é competência?',
  'Como vincular boleto a NF?',
  'Como funciona o fechamento de caixa?'
];

export function HelpChatModal({ open, onOpenChange }: HelpChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { role, unit } = useAuth();
  const location = useLocation();

  // Determina perguntas contextuais baseado na rota atual
  const screenContext = useMemo(() => {
    const path = location.pathname;
    // Tenta match exato primeiro
    if (SCREEN_QUESTIONS[path]) {
      return SCREEN_QUESTIONS[path];
    }
    // Tenta match parcial (para rotas com parâmetros)
    for (const [route, context] of Object.entries(SCREEN_QUESTIONS)) {
      if (path.startsWith(route)) {
        return context;
      }
    }
    return null;
  }, [location.pathname]);

  const suggestedQuestions = screenContext?.questions || DEFAULT_QUESTIONS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(question?: string) {
    const text = question || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content
            })),
            user_context: {
              current_page: location.pathname,
              role: role,
              unit: unit?.name
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: assistantContent
                    };
                    return updated;
                  });
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Help chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Tente novamente ou contate o suporte.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Central de Ajuda LabClin
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Bot className="h-6 w-6 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Olá! 👋</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sou o assistente do LabClin. Posso ajudar com dúvidas sobre o sistema,
                    explicar funcionalidades ou guiá-lo em tarefas específicas.
                  </p>
                </div>
              </div>

              {/* Contexto da tela atual */}
              {screenContext && (
                <div className="flex items-center gap-2 px-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Você está em:</span>
                  <Badge variant="secondary" className="text-xs">
                    {screenContext.name}
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {screenContext ? 'Perguntas sobre esta tela:' : 'Perguntas sugeridas:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-2"
                      onClick={() => handleSend(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg',
                    msg.role === 'user'
                      ? 'bg-primary/10 ml-8'
                      : 'bg-muted/50 mr-8'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <Bot className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex items-center gap-2 text-muted-foreground p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 pt-2 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta..."
              className="min-h-[44px] max-h-[120px] resize-none"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Pressione Enter para enviar • Shift+Enter para nova linha
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
