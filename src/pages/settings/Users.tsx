import { useState, useEffect } from 'react';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Loader2, UserCog, HelpCircle, Building2 } from 'lucide-react';

interface UserWithRole extends Profile {
  role?: AppRole;
  unit?: Unit;
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
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
                            <div className="flex flex-col">
                              <span>{config.label}</span>
                              <span className="text-xs text-muted-foreground">{config.description}</span>
                            </div>
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
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as unidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas as unidades</SelectItem>
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

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(u => (
                      <TableRow key={u.id}>
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
                        <TableCell>{format(new Date(u.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-right">
                          {u.id !== user?.id && (
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={u.role || ''}
                                onValueChange={value => handleUpdateRole(u.id, value as AppRole)}
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
                                value={u.unit_id || ''}
                                onValueChange={value => handleUpdateUnit(u.id, value || null)}
                              >
                                <SelectTrigger className="w-32">
                                  <Building2 className="w-4 h-4 mr-2" />
                                  <SelectValue placeholder="Unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Todas</SelectItem>
                                  {units.map(unit => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}