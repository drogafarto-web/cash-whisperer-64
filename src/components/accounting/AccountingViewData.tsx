import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompetenceData } from '@/hooks/useAccountingCompetence';

interface AccountingViewDataProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  onBack: () => void;
}

export function AccountingViewData({ unitId, unitName, competence, onBack }: AccountingViewDataProps) {
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const { data, isLoading } = useCompetenceData(unitId, ano, mes);
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return format(new Date(date), 'dd/MM/yyyy');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-lg text-muted-foreground mb-2">
            Nenhum dado informado pela contabilidade
          </p>
          <p className="text-sm text-muted-foreground">
            Competência: {competenceLabel} • Unidade: {unitName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Badge variant={data.status === 'confirmado' ? 'default' : 'outline'}>
          {data.status === 'confirmado' ? 'Confirmado' : data.status === 'informado' ? 'Informado' : 'Pendente'}
        </Badge>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Dados da Contabilidade</p>
        <p className="text-xl font-semibold capitalize">{competenceLabel} — {unitName}</p>
        {data.informado_em && (
          <p className="text-xs text-muted-foreground mt-1">
            Informado em: {format(new Date(data.informado_em), "dd/MM/yyyy 'às' HH:mm")}
          </p>
        )}
      </div>

      {/* Folha de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Folha de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Folha</p>
              <p className="text-xl font-semibold">{formatCurrency(data.total_folha)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Encargos</p>
              <p className="text-xl font-semibold">{formatCurrency(data.encargos)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pró-labore</p>
              <p className="text-xl font-semibold">{formatCurrency(data.prolabore)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Funcionários</p>
              <p className="text-xl font-semibold">{data.num_funcionarios || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impostos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" />
            Impostos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">DAS</p>
                {data.das_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.das_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.das_valor)}</p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">DARF</p>
                {data.darf_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.darf_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.darf_valor)}</p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">GPS</p>
                {data.gps_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.gps_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.gps_valor)}</p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">INSS</p>
                {data.inss_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.inss_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.inss_valor)}</p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">FGTS</p>
                {data.fgts_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.fgts_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.fgts_valor)}</p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">ISS</p>
                {data.iss_vencimento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.iss_vencimento)}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold">{formatCurrency(data.iss_valor)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receitas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Receitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Receita de Serviços</p>
              <p className="text-xl font-semibold">{formatCurrency(data.receita_servicos)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outras Receitas</p>
              <p className="text-xl font-semibold">{formatCurrency(data.receita_outras)}</p>
            </div>
          </div>
          {data.receita_observacoes && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{data.receita_observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
