import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Users } from 'lucide-react';

interface LisUser {
  id: string;
  lis_id: number | null;
  login: string;
  nome: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function LisUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<LisUser | null>(null);
  const [formData, setFormData] = useState({ lis_id: '', login: '', nome: '', active: true });

  const { data: lisUsers = [], isLoading } = useQuery({
    queryKey: ['lis-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lis_users')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as LisUser[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<LisUser>) => {
      if (editingUser) {
        const { error } = await supabase
          .from('lis_users')
          .update({ 
            lis_id: data.lis_id ? Number(data.lis_id) : null, 
            login: data.login, 
            nome: data.nome, 
            active: data.active 
          })
          .eq('id', editingUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lis_users')
          .insert({ 
            lis_id: data.lis_id ? Number(data.lis_id) : null, 
            login: data.login, 
            nome: data.nome, 
            active: data.active 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lis-users'] });
      toast.success(editingUser ? 'Operador atualizado!' : 'Operador adicionado!');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        toast.error('Login já existe! Escolha outro.');
      } else {
        toast.error('Erro ao salvar operador');
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('lis_users')
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lis-users'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const handleOpenDialog = (user?: LisUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        lis_id: user.lis_id?.toString() || '',
        login: user.login,
        nome: user.nome,
        active: user.active,
      });
    } else {
      setEditingUser(null);
      setFormData({ lis_id: '', login: '', nome: '', active: true });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({ lis_id: '', login: '', nome: '', active: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.login.trim() || !formData.nome.trim()) {
      toast.error('Preencha login e nome');
      return;
    }
    saveMutation.mutate({
      lis_id: formData.lis_id ? Number(formData.lis_id) : null,
      login: formData.login.trim(),
      nome: formData.nome.trim(),
      active: formData.active,
    });
  };

  const filteredUsers = lisUsers.filter(
    (u) =>
      u.login.toLowerCase().includes(search.toLowerCase()) ||
      u.nome.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = lisUsers.filter((u) => u.active).length;
  const inactiveCount = lisUsers.filter((u) => !u.active).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operadores LIS</h1>
            <p className="text-muted-foreground">
              Gerenciar operadores do sistema LIS
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Editar Operador' : 'Novo Operador'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingUser
                      ? 'Atualize os dados do operador LIS'
                      : 'Adicione um novo operador do LIS'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lis_id">ID LIS (opcional)</Label>
                    <Input
                      id="lis_id"
                      type="number"
                      value={formData.lis_id}
                      onChange={(e) =>
                        setFormData({ ...formData, lis_id: e.target.value })
                      }
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="login">Login *</Label>
                    <Input
                      id="login"
                      value={formData.login}
                      onChange={(e) =>
                        setFormData({ ...formData, login: e.target.value })
                      }
                      placeholder="Login único"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Ativo</Label>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, active: checked })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{lisUsers.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-600">{activeCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-muted-foreground">{inactiveCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Operadores</CardTitle>
            <CardDescription>
              Operadores cadastrados no sistema LIS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por login ou nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum operador encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID LIS</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        {user.lis_id || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{user.login}</TableCell>
                      <TableCell>{user.nome}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? 'default' : 'secondary'}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={user.active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                id: user.id,
                                active: checked,
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(user)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
