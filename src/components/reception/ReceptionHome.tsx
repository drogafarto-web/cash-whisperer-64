import { FileUp, Wallet, FileText, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ReceptionStep = 'home' | 'import' | 'client-invoice' | 'supplier-expense';

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
      id: 'client-invoice' as ReceptionStep,
      label: 'Notas para Clientes',
      icon: FileText,
      description: 'NF-e e recibos',
      onClick: () => onNavigate('client-invoice'),
    },
    {
      id: 'supplier-expense' as ReceptionStep,
      label: 'Notas de Fornecedores',
      icon: Receipt,
      description: 'Despesas e boletos',
      onClick: () => onNavigate('supplier-expense'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
      {buttons.map((btn) => (
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
  );
}
