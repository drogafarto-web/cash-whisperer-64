import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAccountingDashboard } from '@/hooks/useAccountingDashboard';
import { AccountingDataCard } from './AccountingDataCard';
import { AccountingDocumentsCard } from './AccountingDocumentsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AccountingHomeProps {
  competence: Date;
  onGoToExports: () => void;
}

export function AccountingHome({ competence, onGoToExports }: AccountingHomeProps) {
  const navigate = useNavigate();
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const { data, isLoading, refetch } = useAccountingDashboard(ano, mes);

  const handleSendLink = () => {
    // Navigate to the accounting settings to send a new link
    navigate('/settings/data-2025');
    toast.info('Use a aba "Link Contabilidade" para enviar um novo link');
  };

  const handleViewAllDocuments = () => {
    // For now, just show a toast - later can navigate to a dedicated page
    toast.info('Visualização completa em desenvolvimento');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid principal com 4 cards de dados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AccountingDataCard 
          type="impostos" 
          data={{ impostos: data?.impostos }} 
          competence={competence}
        />
        <AccountingDataCard 
          type="receita" 
          data={{ receita: data?.receita }} 
          competence={competence}
        />
        <AccountingDataCard 
          type="folha" 
          data={{ folha: data?.folha }} 
          competence={competence}
        />
        <AccountingDataCard 
          type="fator-r" 
          data={{ fatorR: data?.fatorR }} 
          competence={competence}
        />
      </div>

      {/* Documentos da contabilidade */}
      <AccountingDocumentsCard
        documents={data?.documentos || []}
        linkStatus={data?.linkStatus || { enviado: false, enviadoEm: null, usado: false, expirado: false }}
        onSendLink={handleSendLink}
        onViewAll={handleViewAllDocuments}
      />

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
