import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useConvenioAudit, useConvenioAuditOverview, useAvailableProviders } from '@/features/audit';
import { useAuth } from '@/hooks/useAuth';
import { UnitSelector } from '@/components/UnitSelector';

export default function ConvenioVsInvoice() {
  const { unit, isAdmin, canAccessAllUnits } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    canAccessAllUnits ? null : (unit?.id || null)
  );
  
  // Default: último mês
  const defaultEndDate = endOfMonth(subMonths(new Date(), 1));
  const defaultStartDate = startOfMonth(subMonths(new Date(), 1));
  
  const [startDate, setStartDate] = useState(format(defaultStartDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEndDate, 'yyyy-MM-dd'));
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: providers } = useAvailableProviders(selectedUnitId || undefined);
  
  const { data: overview, isLoading: isLoadingOverview } = useConvenioAuditOverview(
    selectedUnitId,
    startDate,
    endDate,
    shouldFetch && !selectedProvider
  );

  const { data: detailResult, isLoading: isLoadingDetail } = useConvenioAudit(
    selectedUnitId,
    selectedProvider,
    startDate,
    endDate,
    shouldFetch && !!selectedProvider
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

  const getDiferencaColor = (diferenca: number) => {
    if (diferenca === 0) return 'text-green-600';
    if (Math.abs(diferenca) < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDiferencaIcon = (diferenca: number) => {
    if (diferenca === 0) return <Minus className="h-4 w-4 text-green-600" />;
    if (diferenca > 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <TrendingUp className="h-4 w-4 text-green-600" />;
  };

  const isLoading = isLoadingOverview || isLoadingDetail;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auditoria: Convênio vs Nota Fiscal</h1>
            <p className="text-muted-foreground">
              Compare a produção por convênio com as notas fiscais emitidas
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
            <div className="flex items-end gap-4 flex-wrap">
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
              <div className="space-y-2 min-w-[250px]">
                <Label>Convênio (opcional)</Label>
                <Select
                  value={selectedProvider}
                  onValueChange={(v) => {
                    setSelectedProvider(v === 'all' ? '' : v);
                    setShouldFetch(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os convênios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os convênios</SelectItem>
                    {providers?.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
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
          </div>
        )}

        {/* Overview (all providers) */}
        {shouldFetch && !selectedProvider && overview && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Produção</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(overview.reduce((sum, p) => sum + p.total_producao, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {overview.length} convênios
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total NFs Emitidas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(overview.reduce((sum, p) => sum + p.total_nf_emitida, 0))}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Diferença Total</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${getDiferencaColor(overview.reduce((sum, p) => sum + p.diferenca, 0))}`}>
                    {formatCurrency(overview.reduce((sum, p) => sum + p.diferenca, 0))}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Overview Table */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Convênio</CardTitle>
                <CardDescription>
                  Clique em um convênio para ver detalhes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Convênio</TableHead>
                      <TableHead className="text-right">Produção</TableHead>
                      <TableHead className="text-right">NFs</TableHead>
                      <TableHead className="text-right">Qtd Produção</TableHead>
                      <TableHead className="text-right">Qtd NFs</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.map((item) => (
                      <TableRow 
                        key={item.provider_name}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedProvider(item.provider_name);
                          setShouldFetch(true);
                        }}
                      >
                        <TableCell className="font-medium">{item.provider_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_producao)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_nf_emitida)}</TableCell>
                        <TableCell className="text-right">{item.count_producao}</TableCell>
                        <TableCell className="text-right">{item.count_nf}</TableCell>
                        <TableCell className={`text-right ${getDiferencaColor(item.diferenca)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getDiferencaIcon(item.diferenca)}
                            {formatCurrency(item.diferenca)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.diferenca === 0 ? (
                            <Badge variant="default" className="bg-green-600">OK</Badge>
                          ) : item.total_nf_emitida === 0 ? (
                            <Badge variant="destructive">Sem NF</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              Diferença
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Detail View (single provider) */}
        {shouldFetch && selectedProvider && detailResult && (
          <>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedProvider('');
                  setShouldFetch(true);
                }}
              >
                ← Voltar para visão geral
              </Button>
              <h2 className="text-lg font-medium">{selectedProvider}</h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Produção LIS</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(detailResult.summary.total_producao)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detailResult.summary.count_producao} atendimentos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>NFs Emitidas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(detailResult.summary.total_nf_emitida)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detailResult.summary.count_nf} notas
                  </p>
                </CardContent>
              </Card>

              <Card className={detailResult.summary.diferenca === 0 ? 'border-green-500' : 'border-red-500'}>
                <CardHeader className="pb-2">
                  <CardDescription>Diferença</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${getDiferencaColor(detailResult.summary.diferenca)}`}>
                    {formatCurrency(detailResult.summary.diferenca)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detailResult.summary.diferenca === 0 ? 'Faturamento OK' : 
                      detailResult.summary.diferenca > 0 ? 'Falta faturar' : 'NF excede produção'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for Production vs Invoices */}
            <Tabs defaultValue="production">
              <TabsList>
                <TabsTrigger value="production">
                  Produção ({detailResult.production_items.length})
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  Notas Fiscais ({detailResult.invoices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="production">
                <Card>
                  <CardHeader>
                    <CardTitle>Itens de Produção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailResult.production_items.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Código LIS</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailResult.production_items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{format(new Date(item.exam_date), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="font-mono">{item.lis_code}</TableCell>
                              <TableCell>{item.patient_name || '-'}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum registro de produção encontrado
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices">
                <Card>
                  <CardHeader>
                    <CardTitle>Notas Fiscais Emitidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailResult.invoices.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data Emissão</TableHead>
                            <TableHead>Número</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Valor Líquido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailResult.invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell>{format(new Date(invoice.issue_date), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="font-mono">{invoice.document_number}</TableCell>
                              <TableCell>{invoice.customer_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(invoice.net_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma nota fiscal encontrada para este convênio
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {!shouldFetch && !isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Selecione o período e clique em "Auditar" para verificar o faturamento
              </p>
            </CardContent>
          </Card>
        )}

        {shouldFetch && !selectedProvider && overview?.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Nenhum registro de produção de convênios encontrado no período selecionado.
                <br />
                Verifique se os relatórios por convênio foram importados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
