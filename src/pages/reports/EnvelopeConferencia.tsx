import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  Eye,
  Check,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useEnvelopeConferencia, EnvelopeForConferencia } from '@/hooks/useEnvelopeConferencia';
import { EnvelopeDifferenceAlert } from '@/components/cash-closing/EnvelopeDifferenceAlert';
import { QuickConferenciaModal } from '@/components/cash-closing/QuickConferenciaModal';
import { EnvelopeDetailModal } from '@/components/cash-closing/EnvelopeDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function EnvelopeConferencia() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [statusFilter, setStatusFilter] = useState<'PENDENTE' | 'EMITIDO' | 'all'>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickConferenciaEnvelope, setQuickConferenciaEnvelope] = useState<EnvelopeForConferencia | null>(null);
  const [detailEnvelope, setDetailEnvelope] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const {
    envelopes,
    isLoading,
    stats,
    isLoadingStats,
    conferir,
    conferirMultiplos,
    isConferindo,
    refetch,
  } = useEnvelopeConferencia({
    status: statusFilter,
    unitId: unitFilter === 'all' ? undefined : unitFilter,
  });

  // Buscar unidades para filtro
  const { data: units = [] } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('id, name, code').order('name');
      return data || [];
    },
  });

  // Separar envelopes com diferença
  const envelopesComDiferenca = useMemo(
    () => envelopes.filter(e => e.difference && e.difference !== 0),
    [envelopes]
  );

  const envelopesSemDiferenca = useMemo(
    () => envelopes.filter(e => !e.difference || e.difference === 0),
    [envelopes]
  );

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(envelopesSemDiferenca.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleConferirSelecionados = () => {
    if (selectedIds.size === 0) return;
    conferirMultiplos(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleViewEnvelope = async (envelope: EnvelopeForConferencia) => {
    // Montar dados para o modal de detalhe
    const envelopeData = {
      id: envelope.id,
      created_at: envelope.created_at,
      expected_cash: envelope.expected_cash || 0,
      counted_cash: envelope.counted_cash || 0,
      difference: envelope.difference || 0,
      status: envelope.status,
      lis_codes: envelope.lis_codes || [],
      lis_codes_count: envelope.lis_codes_count || 0,
      justificativa: envelope.justificativa,
      unit: { name: envelope.unit_name, code: envelope.unit_code },
    };
    setDetailEnvelope(envelopeData);
    setShowDetailModal(true);
  };

  const handleConferirFromDetail = () => {
    if (detailEnvelope) {
      conferir({ envelopeId: detailEnvelope.id });
    }
    setShowDetailModal(false);
    setDetailEnvelope(null);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Conferência de Envelopes</h1>
              <p className="text-muted-foreground">
                Envelopes de caixa aguardando verificação física
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalPendentes || 0}</div>
                  <p className="text-xs text-muted-foreground">aguardando conferência</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={stats?.totalComDiferenca ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Diferença</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${stats?.totalComDiferenca ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalComDiferenca || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.diferencaTotal ? formatCurrency(stats.diferencaTotal) : 'R$ 0,00'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conferidos Hoje</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalConferidosHoje || 0}</div>
                  <p className="text-xs text-muted-foreground">verificados hoje</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.valorPendente || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">em envelopes</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerta de Envelopes com Diferença */}
        {envelopesComDiferenca.length > 0 && (
          <EnvelopeDifferenceAlert
            envelopes={envelopesComDiferenca}
            onView={handleViewEnvelope}
            onConferir={(id) => conferir({ envelopeId: id })}
            isConferindo={isConferindo}
          />
        )}

        {/* Filtros e Tabela */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Envelopes Pendentes</CardTitle>
                <CardDescription>
                  Selecione envelopes para conferir em lote
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && (
                  <Select value={unitFilter} onValueChange={setUnitFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Todas Unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Unidades</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.code} - {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="EMITIDO">Emitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Ações em Lote */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === envelopesSemDiferenca.length && envelopesSemDiferenca.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={envelopesSemDiferenca.length === 0}
                />
                <span className="text-sm text-muted-foreground">Selecionar todos</span>
              </div>
              <Button
                onClick={handleConferirSelecionados}
                disabled={selectedIds.size === 0 || isConferindo}
              >
                <Check className="h-4 w-4 mr-2" />
                Conferir Selecionados ({selectedIds.size})
              </Button>
            </div>

            {/* Tabela */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : envelopes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum envelope pendente de conferência</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {envelopes.map((envelope) => {
                      const hasDiff = envelope.difference && envelope.difference !== 0;
                      return (
                        <TableRow key={envelope.id} className={hasDiff ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(envelope.id)}
                              onCheckedChange={(checked) => handleSelectOne(envelope.id, !!checked)}
                              disabled={hasDiff}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatDateTime(envelope.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{envelope.unit_code}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(envelope.expected_cash)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(envelope.counted_cash)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={hasDiff ? 'destructive' : 'secondary'}>
                              {formatCurrency(envelope.difference)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={envelope.status === 'EMITIDO' ? 'default' : 'secondary'}>
                              {envelope.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewEnvelope(envelope)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setQuickConferenciaEnvelope(envelope)}
                                disabled={isConferindo}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modais */}
      <QuickConferenciaModal
        open={!!quickConferenciaEnvelope}
        onOpenChange={(open) => !open && setQuickConferenciaEnvelope(null)}
        envelope={quickConferenciaEnvelope}
        onConferir={(id) => {
          conferir({ envelopeId: id });
          setQuickConferenciaEnvelope(null);
        }}
        isConferindo={isConferindo}
      />

      <EnvelopeDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        envelope={detailEnvelope}
        onConferido={handleConferirFromDetail}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
}
