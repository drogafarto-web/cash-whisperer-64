import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole, Unit } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Loader2, UserCog, HelpCircle, Building2, Search, UserX, UserCheck, Clock } from 'lucide-react';

interface UserWithRole extends Profile {
  role?: AppRole;
  unit?: Unit;
  is_active?: boolean;
  last_access?: string | null;
}

// Configuração de papéis com labels e descrições
const ROLE_CONFIG: Record<AppRole, { label: string; description: string; variant: 'default' | 'secondary' | 'outline' }> = {
  admin: { 
    label: 'Administrador', 
    description: 'Acesso total ao sistema: todos os módulos, configurações e dados sensíveis',
    variant: 'default'
  },
  contabilidade: { 
    label: 'Contabilidade', 
    description: 'Acesso a relatórios, cenários tributários, Fator R e exportações. Sem acesso a config.',
    variant: 'secondary'
  },
  financeiro: { 
    label: 'Financeiro', 
    description: 'Contas a pagar, conciliação, extratos bancários. Sem acesso a config tributária.',
    variant: 'secondary'
  },
  contador: { 
    label: 'Contador/Consultor', 
    description: 'Base fiscal: folha, impostos, parâmetros tributários. Sem acesso à operação diária.',
    variant: 'secondary'
  },
  gestor_unidade: { 
    label: 'Gestor de Unidade', 
    description: 'Visão completa da própria unidade: transações, caixa, relatórios filtrados',
    variant: 'secondary'
  },
  secretaria: { 
    label: 'Atendente', 
    description: 'Operacional: registra transações, fechamento de caixa, uploads. Dashboard simplificado',
    variant: 'outline'
  },
};

export default function UsersSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<UserWithRole | null>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('secretaria');
  const [unitId, setUnitId] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
      fetchUnits();
    }
  }, [user, isAdmin]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits(data || []);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      const usersWithRoles = (profiles || []).map(profile => {
        const userUnit = unitsData?.find(u => u.id === profile.unit_id);
        return {
          ...profile,
          role: roles?.find(r => r.user_id === profile.id)?.role as AppRole | undefined,
          unit: userUnit,
          is_active: (profile as any).is_active ?? true,
          last_access: (profile as any).last_access,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!u.name.toLowerCase().includes(search) && !u.email.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Role filter
      if (filterRole !== 'all' && u.role !== filterRole) {
        return false;
      }
      
      // Unit filter
      if (filterUnit !== 'all') {
        if (filterUnit === 'none' && u.unit_id) return false;
        if (filterUnit !== 'none' && u.unit_id !== filterUnit) return false;
      }
      
      // Status filter
      if (filterStatus !== 'all') {
        const isActive = u.is_active !== false;
        if (filterStatus === 'active' && !isActive) return false;
        if (filterStatus === 'inactive' && isActive) return false;
      }
      
      return true;
    });
  }, [users, searchTerm, filterRole, filterUnit, filterStatus]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (authError) throw authError;

      // Add role
      if (authData.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: role,
          });

        if (roleError) {
          console.error('Error adding role:', roleError);
        }

        // Update profile with unit_id if selected
        if (unitId) {
          await supabase
            .from('profiles')
            .update({ unit_id: unitId })
            .eq('id', authData.user.id);
        }
      }

      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
      setEmail('');
      setName('');
      setPassword('');
      setRole('secretaria');
      setUnitId('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error('Erro ao criar usuário');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: AppRole) => {
    try {
      // Delete existing role
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Insert new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: newRole,
      });

      if (error) throw error;
      
      toast.success('Perfil atualizado!');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar perfil');
    }
  };

  const handleUpdateUnit = async (userId: string, newUnitId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ unit_id: newUnitId })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success('Unidade atualizada!');
      fetchUsers();
    } catch (error) {
      console.error('Error updating unit:', error);
      toast.error('Erro ao atualizar unidade');
    }
  };

  const handleToggleActive = async (targetUser: UserWithRole) => {
    const newStatus = targetUser.is_active === false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', targetUser.id);

      if (error) throw error;
      
      toast.success(newStatus ? 'Usuário reativado!' : 'Usuário desativado!');
      setDeactivateUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const formatLastAccess = (lastAccess: string | null | undefined) => {
    if (!lastAccess) return null;
    try {
      return formatDistanceToNow(new Date(lastAccess), { addSuffix: true, locale: ptBR });
    } catch {
      return null;
    }
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
              <p className="text-muted-foreground">Gerencie os usuários e permissões do sistema</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="email@empresa.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Perfil</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Define as permissões e acessos do usuário no sistema</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={role} onValueChange={value => setRole(value as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span>{config.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Unidade Vinculada</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Limita o acesso do usuário aos dados da unidade selecionada. Deixe vazio para acesso a todas.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={unitId || 'all'}
                      onValueChange={(value) => setUnitId(value === 'all' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as unidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as unidades</SelectItem>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Usuário
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Legend */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{config.description}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtrar perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os perfis</SelectItem>
                    {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterUnit} onValueChange={setFilterUnit}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtrar unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas unidades</SelectItem>
                    <SelectItem value="none">Sem unidade</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map(u => {
                      const isActive = u.is_active !== false;
                      const lastAccessText = formatLastAccess(u.last_access);
                      
                      return (
                        <TableRow key={u.id} className={!isActive ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.role ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant={ROLE_CONFIG[u.role]?.variant || 'outline'} className="cursor-help">
                                    {ROLE_CONFIG[u.role]?.label || u.role}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>{ROLE_CONFIG[u.role]?.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="outline">Sem perfil</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.unit ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                {u.unit.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Todas</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lastAccessText ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help">
                                    <Clock className="w-3 h-3" />
                                    {lastAccessText}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{format(new Date(u.last_access!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isActive ? 'default' : 'secondary'}>
                              {isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {u.id !== user?.id && (
                              <div className="flex items-center justify-end gap-2">
                                <Select
                                  value={u.role || ''}
                                  onValueChange={value => handleUpdateRole(u.id, value as AppRole)}
                                  disabled={!isActive}
                                >
                                  <SelectTrigger className="w-36">
                                    <UserCog className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Perfil" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                                      <SelectItem key={key} value={key}>
                                        {config.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={u.unit_id || 'all'}
                                  onValueChange={value => handleUpdateUnit(u.id, value === 'all' ? null : value)}
                                  disabled={!isActive}
                                >
                                  <SelectTrigger className="w-32">
                                    <Building2 className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Unidade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {units.map(unit => (
                                      <SelectItem key={unit.id} value={unit.id}>
                                        {unit.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={isActive ? 'outline' : 'default'}
                                      size="icon"
                                      onClick={() => isActive ? setDeactivateUser(u) : handleToggleActive(u)}
                                    >
                                      {isActive ? (
                                        <UserX className="w-4 h-4" />
                                      ) : (
                                        <UserCheck className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isActive ? 'Desativar usuário' : 'Reativar usuário'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog open={!!deactivateUser} onOpenChange={() => setDeactivateUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o usuário <strong>{deactivateUser?.name}</strong>?
                <br /><br />
                O usuário não poderá mais acessar o sistema, mas seus dados serão mantidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deactivateUser && handleToggleActive(deactivateUser)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </AppLayout>
  );
}
