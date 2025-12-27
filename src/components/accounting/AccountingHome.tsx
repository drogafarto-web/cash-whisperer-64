import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Receipt, 
  Download, 
  Calculator,
  Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccountingHomeProps {
  competence: Date;
  onGoToExports: () => void;
}

export function AccountingHome({ competence, onGoToExports }: AccountingHomeProps) {
  const navigate = useNavigate();
  const monthParam = format(competence, 'yyyy-MM');

  const cards = [
    {
      id: 'taxes',
      icon: TrendingUp,
      title: 'Impostos do Mês',
      description: 'Cenários tributários e apuração',
      badge: 'Simples Nacional',
      badgeVariant: 'secondary' as const,
      onClick: () => navigate(`/reports/tax-scenarios?month=${monthParam}`),
    },
    {
      id: 'payroll',
      icon: Users,
      title: 'Folha de Pagamento',
      description: 'Base fiscal e custos de pessoal',
      onClick: () => navigate('/settings/fiscal-base'),
    },
    {
      id: 'supplier-invoices',
      icon: FileText,
      title: 'NFs Fornecedores',
      description: 'Notas fiscais recebidas',
      onClick: () => navigate(`/payables/supplier-invoices?month=${monthParam}`),
    },
    {
      id: 'client-invoices',
      icon: Receipt,
      title: 'NFs Clientes / Faturamento',
      description: 'Notas emitidas e resumo',
      onClick: () => navigate(`/billing/summary?month=${monthParam}`),
    },
    {
      id: 'fator-r',
      icon: Calculator,
      title: 'Fator R / Anexos',
      description: 'Evolução e alertas tributários',
      onClick: () => navigate('/settings/fator-r-audit'),
    },
    {
      id: 'cashflow',
      icon: Wallet,
      title: 'Fluxo de Caixa',
      description: 'Projeção 12 meses',
      onClick: () => navigate('/reports/cashflow-projection'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Grid principal com 6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card 
            key={card.id}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
            onClick={card.onClick}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <card.icon className="h-6 w-6" />
                </div>
                {card.badge && (
                  <Badge variant={card.badgeVariant}>{card.badge}</Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Card grande de Exportação */}
      <Card 
        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group border-dashed border-2"
        onClick={onGoToExports}
      >
        <CardContent className="p-8 flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors mb-4">
            <Download className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Exportar para Contabilidade</h3>
          <p className="text-muted-foreground max-w-md">
            Gerar arquivos para Domínio, exportar transações em Excel ou gerar resumo em PDF
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
