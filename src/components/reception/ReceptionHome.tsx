import { FileUp, Wallet, FileText, Banknote, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ReceptionStep = 'home' | 'import' | 'document-upload' | 'payment';

interface ReceptionHomeProps {
  onNavigate: (step: ReceptionStep) => void;
  onCheckEnvelope: () => void;
}

export function ReceptionHome({ onNavigate, onCheckEnvelope }: ReceptionHomeProps) {
  const buttons = [
    {
      id: 'import' as ReceptionStep,
      label: 'Importar Movimento do Dia',
      icon: FileUp,
      description: 'Upload do relatório LIS',
      onClick: () => onNavigate('import'),
    },
    {
      id: 'envelope' as const,
      label: 'Fechar Envelope do Dia',
      icon: Wallet,
      description: 'Contagem de dinheiro',
      onClick: onCheckEnvelope,
    },
    {
      id: 'document-upload' as ReceptionStep,
      label: 'Cadastrar Documentos',
      icon: Sparkles,
      description: 'NF-e, recibos e notas de fornecedores com IA',
      onClick: () => onNavigate('document-upload'),
    },
    {
      id: 'payment' as ReceptionStep,
      label: 'Registrar Pagamento',
      icon: Banknote,
      description: 'Boleto pago / PIX',
      onClick: () => onNavigate('payment'),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {buttons.slice(0, 4).map((btn) => (
          <Button
            key={btn.id}
            variant="outline"
            className="h-40 flex flex-col items-center justify-center gap-4 text-xl font-semibold border-2 hover:border-primary hover:bg-primary/5 transition-all"
            onClick={btn.onClick}
          >
            <btn.icon className="h-12 w-12 text-primary" />
            <div className="text-center">
              <div>{btn.label}</div>
              <div className="text-sm font-normal text-muted-foreground mt-1">
                {btn.description}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
