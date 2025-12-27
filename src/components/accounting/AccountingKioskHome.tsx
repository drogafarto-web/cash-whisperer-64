import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Receipt, 
  TrendingUp, 
  FileText, 
  Wallet, 
  FileUp, 
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompetenceData, useLabSubmission, useLabDocuments } from '@/hooks/useAccountingCompetence';

interface AccountingKioskHomeProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  onViewData: () => void;
  onSendDocuments: () => void;
  isAccountingRole?: boolean;
}

function StatusBadge({ status }: { status: 'pendente' | 'informado' | 'confirmado' | 'rascunho' | 'enviado' | 'recebido' }) {
  const config = {
    pendente: { label: 'Pendente', variant: 'outline' as const, icon: Clock },
    informado: { label: 'Informado', variant: 'default' as const, icon: CheckCircle2 },
    confirmado: { label: 'Confirmado', variant: 'default' as const, icon: CheckCircle2 },
    rascunho: { label: 'Rascunho', variant: 'outline' as const, icon: AlertCircle },
    enviado: { label: 'Enviado', variant: 'default' as const, icon: Send },
    recebido: { label: 'Recebido', variant: 'default' as const, icon: CheckCircle2 },
  };
  
  const { label, variant, icon: Icon } = config[status];
  
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function AccountingKioskHome({ 
  unitId, 
  unitName, 
  competence, 
  onViewData, 
  onSendDocuments,
  isAccountingRole = true,
}: AccountingKioskHomeProps) {
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const { data: competenceData, isLoading: loadingData } = useCompetenceData(unitId, ano, mes);
  const { data: submission, isLoading: loadingSubmission } = useLabSubmission(unitId, ano, mes);
  const { data: documents = [] } = useLabDocuments(submission?.id || null);
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });
  
  const nfCount = documents.filter(d => d.tipo === 'nf').length;
  const despesaCount = documents.filter(d => d.tipo === 'despesa').length;
  const extratoCount = documents.filter(d => d.tipo === 'extrato_bancario').length;

  if (!unitId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione uma unidade para continuar</p>
      </div>
    );
  }

  if (loadingData || loadingSubmission) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header com informações da competência */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Competência</p>
            <p className="text-xl font-semibold capitalize">{competenceLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Unidade</p>
            <p className="text-xl font-semibold">{unitName}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Fluxo contínuo Jan/2026+ • Dados para cálculos fiscais e de fluxo
        </p>
      </div>

      {/* Dados informados pela contabilidade */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              📋 Contabilidade Informa
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAccountingRole 
                ? 'Dados informados pela contabilidade' 
                : 'Resumo dos dados informados pela contabilidade'}
            </p>
          </div>
          <StatusBadge status={competenceData?.status || 'pendente'} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Folha */}
          <Card 
            className={`transition-colors ${isAccountingRole ? 'hover:border-primary/50 cursor-pointer' : 'opacity-90'}`} 
            onClick={isAccountingRole ? onViewData : undefined}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Folha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(competenceData?.total_folha)}</p>
              {isAccountingRole ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {competenceData?.num_funcionarios || 0} funcionários
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Total consolidado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card Impostos */}
          <Card 
            className={`transition-colors ${isAccountingRole ? 'hover:border-primary/50 cursor-pointer' : 'opacity-90'}`} 
            onClick={isAccountingRole ? onViewData : undefined}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-orange-500" />
                Impostos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  (competenceData?.das_valor || 0) + 
                  (competenceData?.darf_valor || 0) + 
                  (competenceData?.gps_valor || 0) +
                  (competenceData?.iss_valor || 0)
                )}
              </p>
              {isAccountingRole ? (
                <p className="text-xs text-muted-foreground mt-1">
                  DAS + DARF + GPS + ISS
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Total consolidado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card Receitas */}
          <Card 
            className={`transition-colors ${isAccountingRole ? 'hover:border-primary/50 cursor-pointer' : 'opacity-90'}`} 
            onClick={isAccountingRole ? onViewData : undefined}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(competenceData?.receita_servicos)}</p>
              {isAccountingRole ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Serviços + {formatCurrency(competenceData?.receita_outras)} outras
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Receita de serviços
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {!competenceData && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Aguardando dados da contabilidade para esta competência
          </p>
        )}
      </div>

      {/* Separador */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              🧪 Laboratório Envia
            </h2>
            <p className="text-xs text-muted-foreground">
              Documentos enviados pelo laboratório
            </p>
          </div>
          {submission && <StatusBadge status={submission.status} />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Notas Fiscais */}
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                Notas Fiscais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{nfCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                arquivos enviados
              </p>
            </CardContent>
          </Card>

          {/* Card Despesas */}
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4 text-red-500" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{despesaCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                itens registrados
              </p>
            </CardContent>
          </Card>

          {/* Card Extrato */}
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSendDocuments}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileUp className="h-4 w-4 text-teal-500" />
                Extrato Bancário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{extratoCount > 0 ? '✓' : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {extratoCount > 0 ? 'Enviado' : 'Pendente'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Botão de ação principal */}
      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          onClick={onSendDocuments}
          className="gap-2"
          disabled={submission?.status === 'enviado' || submission?.status === 'recebido'}
        >
          <Send className="h-5 w-5" />
          {submission?.status === 'enviado' 
            ? 'Documentos Enviados' 
            : submission?.status === 'recebido'
            ? 'Documentos Recebidos'
            : 'Preparar Envio para Contabilidade'}
        </Button>
      </div>
    </div>
  );
}
