import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Building2,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PatrimonyItem {
  id: string;
  tipo: 'ATIVO' | 'PASSIVO';
  categoria: string;
  descricao: string;
  valor_atual: number;
  valor_original: number | null;
  data_aquisicao: string | null;
  data_vencimento: string | null;
  proprietario_tipo: string | null;
  proprietario_nome: string | null;
  observacoes: string | null;
  unit_id: string | null;
  created_at: string;
}

interface RelatedPartyItem {
  id: string;
  tipo: 'payable' | 'invoice';
  descricao: string;
  valor: number;
  vencimento: string | null;
  parte_relacionada_tipo: string;
  parte_relacionada_nome: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  IMOVEL: 'Imóvel',
  VEICULO: 'Veículo',
  EQUIPAMENTO: 'Equipamento',
  INVESTIMENTO: 'Investimento',
  EMPRESTIMO_BANCARIO: 'Empréstimo Bancário',
  FINANCIAMENTO: 'Financiamento',
  EMPRESTIMO_PARTES_RELACIONADAS: 'Empréstimo Partes Relacionadas',
  OUTROS: 'Outros',
};

const PROPRIETARIO_LABELS: Record<string, string> = {
  EMPRESA: 'Empresa',
  HOLDING: 'Holding',
  SOCIO: 'Sócio',
  FAMILIAR: 'Familiar',
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Patrimony() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PatrimonyItem | null>(null);
  const [formData, setFormData] = useState({
    tipo: 'ATIVO' as 'ATIVO' | 'PASSIVO',
    categoria: '',
    descricao: '',
    valor_atual: '',
    valor_original: '',
    data_aquisicao: '',
    data_vencimento: '',
    proprietario_tipo: '',
    proprietario_nome: '',
    observacoes: '',
  });

  // Fetch patrimony items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['patrimony-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrimony_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PatrimonyItem[];
    },
  });

  // Fetch related party payables
  const { data: relatedPartyPayables = [] } = useQuery({
    queryKey: ['related-party-payables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payables')
        .select('id, beneficiario, valor, vencimento, parte_relacionada_tipo, parte_relacionada_nome')
        .not('parte_relacionada_tipo', 'is', null);
      if (error) throw error;
      return data.map(p => ({
        id: p.id,
        tipo: 'payable' as const,
        descricao: p.beneficiario || 'Sem descrição',
        valor: Number(p.valor),
        vencimento: p.vencimento,
        parte_relacionada_tipo: p.parte_relacionada_tipo || '',
        parte_relacionada_nome: p.parte_relacionada_nome || '',
      }));
    },
  });

  // Fetch related party invoices
  const { data: relatedPartyInvoices = [] } = useQuery({
    queryKey: ['related-party-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, customer_name, net_value, issue_date, parte_relacionada_tipo, parte_relacionada_nome')
        .not('parte_relacionada_tipo', 'is', null);
      if (error) throw error;
      return data.map(i => ({
        id: i.id,
        tipo: 'invoice' as const,
        descricao: i.customer_name,
        valor: Number(i.net_value),
        vencimento: i.issue_date,
        parte_relacionada_tipo: i.parte_relacionada_tipo || '',
        parte_relacionada_nome: i.parte_relacionada_nome || '',
      }));
    },
  });

  const relatedPartyItems = [...relatedPartyPayables, ...relatedPartyInvoices];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('patrimony_items').insert({
        tipo: data.tipo,
        categoria: data.categoria,
        descricao: data.descricao,
        valor_atual: parseFloat(data.valor_atual) || 0,
        valor_original: data.valor_original ? parseFloat(data.valor_original) : null,
        data_aquisicao: data.data_aquisicao || null,
        data_vencimento: data.data_vencimento || null,
        proprietario_tipo: data.proprietario_tipo || null,
        proprietario_nome: data.proprietario_nome || null,
        observacoes: data.observacoes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony-items'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Item adicionado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao adicionar item');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('patrimony_items').update({
        tipo: data.tipo,
        categoria: data.categoria,
        descricao: data.descricao,
        valor_atual: parseFloat(data.valor_atual) || 0,
        valor_original: data.valor_original ? parseFloat(data.valor_original) : null,
        data_aquisicao: data.data_aquisicao || null,
        data_vencimento: data.data_vencimento || null,
        proprietario_tipo: data.proprietario_tipo || null,
        proprietario_nome: data.proprietario_nome || null,
        observacoes: data.observacoes || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony-items'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast.success('Item atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patrimony_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony-items'] });
      toast.success('Item removido');
    },
    onError: () => {
      toast.error('Erro ao remover item');
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: 'ATIVO',
      categoria: '',
      descricao: '',
      valor_atual: '',
      valor_original: '',
      data_aquisicao: '',
      data_vencimento: '',
      proprietario_tipo: '',
      proprietario_nome: '',
      observacoes: '',
    });
  };

  const handleEdit = (item: PatrimonyItem) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor_atual: item.valor_atual.toString(),
      valor_original: item.valor_original?.toString() || '',
      data_aquisicao: item.data_aquisicao || '',
      data_vencimento: item.data_vencimento || '',
      proprietario_tipo: item.proprietario_tipo || '',
      proprietario_nome: item.proprietario_nome || '',
      observacoes: item.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.categoria || !formData.descricao || !formData.valor_atual) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Calculate totals
  const ativos = items.filter(i => i.tipo === 'ATIVO');
  const passivos = items.filter(i => i.tipo === 'PASSIVO');
  const totalAtivos = ativos.reduce((sum, i) => sum + Number(i.valor_atual), 0);
  const totalPassivos = passivos.reduce((sum, i) => sum + Number(i.valor_atual), 0);
  const patrimonioLiquido = totalAtivos - totalPassivos;

  // Chart data
  const ativosChartData = Object.entries(
    ativos.reduce((acc, item) => {
      const cat = CATEGORIA_LABELS[item.categoria] || item.categoria;
      acc[cat] = (acc[cat] || 0) + Number(item.valor_atual);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const totalRelatedPayables = relatedPartyPayables.reduce((sum, p) => sum + p.valor, 0);
  const totalRelatedInvoices = relatedPartyInvoices.reduce((sum, i) => sum + i.valor, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Patrimônio do Grupo
            </h1>
            <p className="text-muted-foreground">
              Visão consolidada de ativos, passivos e partes relacionadas
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingItem(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item Patrimonial'}</DialogTitle>
                <DialogDescription>
                  {editingItem ? 'Atualize as informações do item.' : 'Adicione um ativo ou passivo ao patrimônio.'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v as 'ATIVO' | 'PASSIVO' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="PASSIVO">Passivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input 
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Ex: Imóvel sede matriz"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Atual *</Label>
                    <Input 
                      type="number"
                      value={formData.valor_atual}
                      onChange={(e) => setFormData({ ...formData, valor_atual: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Original</Label>
                    <Input 
                      type="number"
                      value={formData.valor_original}
                      onChange={(e) => setFormData({ ...formData, valor_original: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Aquisição</Label>
                    <Input 
                      type="date"
                      value={formData.data_aquisicao}
                      onChange={(e) => setFormData({ ...formData, data_aquisicao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Vencimento</Label>
                    <Input 
                      type="date"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo Proprietário</Label>
                    <Select value={formData.proprietario_tipo} onValueChange={(v) => setFormData({ ...formData, proprietario_tipo: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROPRIETARIO_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Proprietário</Label>
                    <Input 
                      value={formData.proprietario_nome}
                      onChange={(e) => setFormData({ ...formData, proprietario_nome: e.target.value })}
                      placeholder="Nome"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Notas adicionais..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Patrimônio Líquido</CardDescription>
                  <CardTitle className={`text-2xl flex items-center gap-2 ${patrimonioLiquido >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    <Wallet className="h-5 w-5" />
                    {formatCurrency(patrimonioLiquido)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Ativos</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2 text-blue-600">
                    <TrendingUp className="h-5 w-5" />
                    {formatCurrency(totalAtivos)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Passivos</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                    {formatCurrency(totalPassivos)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Partes Relacionadas</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    {relatedPartyItems.length} itens
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Tabs defaultValue="ativos" className="space-y-4">
              <TabsList>
                <TabsTrigger value="ativos">Ativos ({ativos.length})</TabsTrigger>
                <TabsTrigger value="passivos">Passivos ({passivos.length})</TabsTrigger>
                <TabsTrigger value="relacionadas">Partes Relacionadas ({relatedPartyItems.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="ativos" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Ativos do Grupo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Proprietário</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ativos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                Nenhum ativo cadastrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            ativos.map(item => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.descricao}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{CATEGORIA_LABELS[item.categoria]}</Badge>
                                </TableCell>
                                <TableCell>
                                  {item.proprietario_tipo && (
                                    <span className="text-sm">
                                      {PROPRIETARIO_LABELS[item.proprietario_tipo]} 
                                      {item.proprietario_nome && ` - ${item.proprietario_nome}`}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(Number(item.valor_atual))}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Composição</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {ativosChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={ativosChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {ativosChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">Sem dados</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="passivos">
                <Card>
                  <CardHeader>
                    <CardTitle>Passivos e Dívidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {passivos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              Nenhum passivo cadastrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          passivos.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.descricao}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{CATEGORIA_LABELS[item.categoria]}</Badge>
                              </TableCell>
                              <TableCell>
                                {item.data_vencimento && format(new Date(item.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right font-medium text-red-600">
                                {formatCurrency(Number(item.valor_atual))}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="relacionadas" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardDescription>A Pagar (Partes Relacionadas)</CardDescription>
                      <CardTitle className="text-xl text-red-600">{formatCurrency(totalRelatedPayables)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardDescription>A Receber (Partes Relacionadas)</CardDescription>
                      <CardTitle className="text-xl text-green-600">{formatCurrency(totalRelatedInvoices)}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Fluxos entre Partes Relacionadas</CardTitle>
                    <CardDescription>
                      Payables e invoices marcados como transações com partes relacionadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Parte Relacionada</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatedPartyItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              Nenhum item com parte relacionada
                            </TableCell>
                          </TableRow>
                        ) : (
                          relatedPartyItems.map(item => (
                            <TableRow key={`${item.tipo}-${item.id}`}>
                              <TableCell>
                                <Badge variant={item.tipo === 'payable' ? 'destructive' : 'default'}>
                                  {item.tipo === 'payable' ? 'A Pagar' : 'A Receber'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.descricao}</TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {PROPRIETARIO_LABELS[item.parte_relacionada_tipo] || item.parte_relacionada_tipo}
                                  {item.parte_relacionada_nome && ` - ${item.parte_relacionada_nome}`}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${item.tipo === 'payable' ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(item.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
