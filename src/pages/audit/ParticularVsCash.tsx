import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useParticularAudit } from '@/features/audit';
import { useAuth } from '@/hooks/useAuth';
import { UnitSelector } from '@/components/UnitSelector';

export default function ParticularVsCash() {
  const { unit, isAdmin, canAccessAllUnits } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    canAccessAllUnits ? null : (unit?.id || null)
  );
  
  // Default: último mês
  const defaultEndDate = endOfMonth(subMonths(new Date(), 1));
  const defaultStartDate = startOfMonth(subMonths(new Date(), 1));
  
  const [startDate, setStartDate] = useState(format(defaultStartDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEndDate, 'yyyy-MM-dd'));
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: auditResult, isLoading, error } = useParticularAudit(
    selectedUnitId,
    startDate,
    endDate,
    shouldFetch
  );

  const handleSearch = () => {
    setShouldFetch(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'PENDENTE':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'NAO_ENCONTRADO':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return <Badge variant="default" className="bg-green-600">OK</Badge>;
      case 'PENDENTE':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'NAO_ENCONTRADO':
        return <Badge variant="destructive">Não Encontrado</Badge>;
      default:
        return null;
    }
  };

  const getDiferencaIcon = () => {
    if (!auditResult) return null;
    const diff = auditResult.summary.diferenca;
    if (diff === 0) return <Minus className="h-5 w-5 text-green-600" />;
    if (diff > 0) return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <TrendingUp className="h-5 w-5 text-green-600" />;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auditoria: Particulares vs Caixa</h1>
            <p className="text-muted-foreground">
              Compare a produção de particulares com o fechamento de caixa
            </p>
          </div>
          {(isAdmin || canAccessAllUnits) && (
            <UnitSelector value={selectedUnitId} onChange={setSelectedUnitId} />
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setShouldFetch(false);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setShouldFetch(false);
                  }}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="mr-2 h-4 w-4" />
                Auditar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Erro ao carregar auditoria: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {auditResult && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Produção</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(auditResult.summary.total_producao)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {auditResult.summary.count_total} atendimentos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Resolvido</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(auditResult.summary.total_resolvido)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {auditResult.summary.count_ok} itens OK
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Pendente</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(auditResult.summary.total_pendente)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {auditResult.summary.count_pendente + auditResult.summary.count_nao_encontrado} pendências
                  </p>
                </CardContent>
              </Card>

              <Card className={auditResult.summary.diferenca === 0 ? 'border-green-500' : 'border-red-500'}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    Diferença
                    {getDiferencaIcon()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${auditResult.summary.diferenca === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(auditResult.summary.diferenca)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {auditResult.summary.diferenca === 0 ? 'Fechamento OK' : 'Pendente resolução'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>OK: {auditResult.summary.count_ok}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span>Pendente: {auditResult.summary.count_pendente}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span>Não Encontrado: {auditResult.summary.count_nao_encontrado}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Items Table */}
            {auditResult.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pendências para Resolução</CardTitle>
                  <CardDescription>
                    Itens que precisam de atenção ({auditResult.items.length} registros)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Código LIS</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead className="text-right">Valor Produção</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditResult.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{format(new Date(item.exam_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="font-mono">{item.lis_code}</TableCell>
                          <TableCell>{item.patient_name || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-muted-foreground">{item.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {auditResult.items.length === 0 && auditResult.summary.count_total > 0 && (
              <Card className="border-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                    <p className="text-lg font-medium">
                      Todos os atendimentos particulares estão fechados no caixa!
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {auditResult.summary.count_total === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Nenhum registro de produção de particulares encontrado no período selecionado.
                    <br />
                    Verifique se os relatórios por convênio foram importados.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!shouldFetch && !isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Selecione o período e clique em "Auditar" para verificar a conciliação
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
