import { FileUp, Wallet, FileText, Receipt, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ReceptionStep = 'home' | 'import' | 'client-invoice' | 'supplier-expense' | 'payment';

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
      
      {/* 5th button spanning full width */}
      {(() => {
        const PaymentIcon = buttons[4].icon;
        return (
          <Button
            variant="outline"
            className="w-full h-32 mt-6 flex flex-col items-center justify-center gap-3 text-xl font-semibold border-2 hover:border-primary hover:bg-primary/5 transition-all"
            onClick={buttons[4].onClick}
          >
            <PaymentIcon className="h-10 w-10 text-primary" />
            <div className="text-center">
              <div>{buttons[4].label}</div>
              <div className="text-sm font-normal text-muted-foreground mt-1">
                {buttons[4].description}
              </div>
            </div>
          </Button>
        );
      })()}
    </div>
  );
}
