import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldCheck, Plus, TrendingDown, Calendar, Loader2, FileText, Zap } from 'lucide-react';

import { RequireRole } from '@/components/auth/RequireRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logFiscalControlAccess } from '@/services/cashAuditService';
import { FiscalConfirmModal } from './FiscalConfirmModal';
import { BankStatementsTab } from './BankStatementsTab';
import { QuickOpsTab } from './QuickOpsTab';
import { formatCurrency } from '@/lib/formats';

// UUID do dono - único usuário com acesso à aba Ops Rápidas
const OWNER_USER_ID = '7ecf8586-6bb1-4c10-82de-f0e8135e1d8f';

// IDs das categorias informais (já existentes no banco)
const INFORMAL_CATEGORIES = [
  { id: 'dd6bb036-bb2e-4729-82e5-952d0d6c1ce4', name: 'Comissão Informal' },
  { id: '7cd44df1-548a-41e3-a6ee-5055108c8ffb', name: 'Complementação Salarial Informal' },
  { id: 'f58c11f2-2ece-4a1d-90db-17a6ed52eb75', name: 'Premiação Informal' },
];

interface AggregatedData {
  month: string;
  total: number;
  count: number;
}

export default function FiscalControl() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Verifica se é o dono (único com acesso a Ops Rápidas)
  const isOwner = user?.id === OWNER_USER_ID;
  
  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  // Proteção por role admin é feita pelo RequireRole no wrapper do componente

  // ============================================
  // LOG DE ACESSO quando confirma
  // ============================================
  useEffect(() => {
    if (confirmed && user?.id) {
      logFiscalControlAccess({
        userId: user.id,
        action: 'viewed',
      });
    }
  }, [confirmed, user?.id]);

  // ============================================
  // QUERY: Buscar dados agregados (totais por mês)
  // ============================================
  const { data: aggregatedData, isLoading } = useQuery({
    queryKey: ['fiscal-control-aggregated'],
    queryFn: async () => {
      const categoryIds = INFORMAL_CATEGORIES.map(c => c.id);
      
      const { data, error } = await supabase
        .from('payables')
        .select('valor, vencimento, category_id')
        .in('category_id', categoryIds)
        .order('vencimento', { ascending: false });
      
      if (error) throw error;
      
      // Agregar por mês (não expõe detalhes individuais)
      const byMonth: Record<string, { total: number; count: number }> = {};
      
      (data || []).forEach((item) => {
        const monthKey = format(new Date(item.vencimento), 'yyyy-MM');
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { total: 0, count: 0 };
        }
        byMonth[monthKey].total += item.valor || 0;
        byMonth[monthKey].count += 1;
      });
      
      return Object.entries(byMonth).map(([month, values]) => ({
        month,
        ...values,
      })) as AggregatedData[];
    },
    enabled: confirmed,
  });

  // ============================================
  // MUTATION: Criar novo lançamento informal
  // ============================================
  const createPayment = useMutation({
    mutationFn: async (paymentData: { category_id: string; valor: number; vencimento: string; description: string }) => {
      const { error } = await supabase.from('payables').insert({
        category_id: paymentData.category_id,
        valor: paymentData.valor,
        vencimento: paymentData.vencimento,
        description: paymentData.description,
        status: 'pending',
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento informal registrado');
      queryClient.invalidateQueries({ queryKey: ['fiscal-control-aggregated'] });
      
      // Log da criação
      if (user?.id) {
        logFiscalControlAccess({
          userId: user.id,
          action: 'created',
          amount: parseFloat(amount),
          categoryId,
        });
      }
      
      // Reset form
      setCategoryId('');
      setAmount('');
      setDueDate('');
      setDescription('');
      setShowForm(false);
    },
    onError: (error) => {
      console.error('Erro ao criar pagamento:', error);
      toast.error('Erro ao registrar pagamento');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryId || !amount || !dueDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    createPayment.mutate({
      category_id: categoryId,
      valor: parseFloat(amount),
      vencimento: dueDate,
      description: description || 'Pagamento informal',
    });
  };

  // Calcular totais
  const totalGeral = aggregatedData?.reduce((sum, item) => sum + item.total, 0) || 0;
  const totalLancamentos = aggregatedData?.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <RequireRole roles={['admin']}>
      {/* Modal de confirmação antes de exibir dados */}
      <FiscalConfirmModal
        open={!confirmed}
        onConfirm={() => setConfirmed(true)}
        onCancel={() => window.history.back()}
      />
      
      {confirmed && (
        <AppLayout>
          <div className="container mx-auto py-6 max-w-4xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Controle Fiscal Interno</h1>
                <p className="text-sm text-muted-foreground">
                  Pagamentos fora do Fator R • Extratos Bancários • Acesso restrito
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="informal" className="space-y-6">
              <TabsList>
                <TabsTrigger value="informal" className="gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Pagamentos Informais
                </TabsTrigger>
                <TabsTrigger value="extratos" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Extratos Bancários
                </TabsTrigger>
                {isOwner && (
                  <TabsTrigger value="ops" className="gap-2">
                    <Zap className="h-4 w-4" />
                    Ops Rápidas
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Tab: Pagamentos Informais */}
              <TabsContent value="informal" className="space-y-6">
                <div className="flex justify-end">
                  <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}>
                    <Plus className="h-4 w-4 mr-2" />
                    {showForm ? 'Cancelar' : 'Novo Lançamento'}
                  </Button>
                </div>

                {/* Formulário de lançamento */}
                {showForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Registrar Pagamento Informal</CardTitle>
                      <CardDescription>
                        Esses valores NÃO entrarão no cálculo do Fator R
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category">Categoria *</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {INFORMAL_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="amount">Valor (R$) *</Label>
                            <Input
                              id="amount"
                              type="number"
                              step="0.01"
                              min="0"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="0,00"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="dueDate">Data *</Label>
                            <Input
                              id="dueDate"
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="description">Observação</Label>
                            <Textarea
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Descrição opcional..."
                              rows={1}
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button type="submit" disabled={createPayment.isPending}>
                            {createPayment.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              'Registrar Pagamento'
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Cards de resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Acumulado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-destructive" />
                        <span className="text-2xl font-bold">
                          {formatCurrency(totalGeral)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total de Lançamentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-2xl font-bold">
                          {totalLancamentos}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Dados agregados por mês */}
                <Card>
                  <CardHeader>
                    <CardTitle>Histórico Agregado</CardTitle>
                    <CardDescription>
                      Totais mensais • Sem detalhes de beneficiários
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : aggregatedData && aggregatedData.length > 0 ? (
                      <div className="space-y-2">
                        {aggregatedData.map((item) => (
                          <div
                            key={item.month}
                            className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(item.month + '-01'), 'MMMM yyyy', { locale: ptBR })}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({item.count} lançamento{item.count !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <span className="font-semibold text-destructive">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum lançamento informal registrado ainda.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Extratos Bancários */}
              <TabsContent value="extratos">
                <BankStatementsTab userId={user?.id || ''} />
              </TabsContent>

              {/* Tab: Ops Rápidas (apenas para o dono) */}
              {isOwner && (
                <TabsContent value="ops">
                  <QuickOpsTab userId={user?.id || ''} />
                </TabsContent>
              )}
            </Tabs>

            {/* Aviso de segurança */}
            <div className="text-center text-xs text-muted-foreground">
              🔒 Acesso logado em auditoria • Dados agregados para segurança
            </div>
          </div>
        </AppLayout>
      )}
    </RequireRole>
  );
}
