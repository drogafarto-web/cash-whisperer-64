import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Loader2, UserCog, Building2, Search, UserX, UserCheck, Clock, Mail, MailPlus, Pencil, Star, Briefcase, Link2, FileSpreadsheet } from 'lucide-react';

// Componentes RBAC
import { RoleSummaryPanel } from '@/components/users/RoleSummaryPanel';
import { RoleGuideModal } from '@/components/users/RoleGuideModal';
import { UserFormAdaptive } from '@/components/users/UserFormAdaptive';
import { UserEditDialog } from '@/components/users/UserEditDialog';
import { ExcelImportModal } from '@/components/users/ExcelImportModal';
import { ROLE_CONFIG } from '@/lib/access-policy';

// Hooks
import { useAllProfileUnits, useUpdateProfileUnits, ProfileUnit } from '@/hooks/useProfileUnits';
import { useAllProfileFunctions, useUpdateProfileFunctions, OPERATIONAL_FUNCTIONS, ProfileFunction } from '@/hooks/useProfileFunctions';
import { useLinkLisLogin } from '@/hooks/useLisUsers';

interface UserWithRole extends Profile {
  role?: AppRole;
  unit?: Unit;
  is_active?: boolean;
  last_access?: string | null;
  lis_login?: string | null;
  lis_id?: number | null;
}

// Tipo de status para UI
type UserStatus = 'active' | 'inactive' | 'invited';

function getUserStatus(user: UserWithRole): UserStatus {
  if (user.is_active === false) return 'inactive';
  if (!user.last_access) return 'invited';
  return 'active';
}

function getStatusConfig(status: UserStatus) {
  switch (status) {
    case 'active':
      return { label: 'Ativo', variant: 'default' as const };
    case 'inactive':
      return { label: 'Suspenso', variant: 'secondary' as const };
    case 'invited':
      return { label: 'Convidado', variant: 'outline' as const };
  }
}

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
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  
  // Edit dialog state
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  
  // Excel Import modal state
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // Fetch profile units and functions
  const { data: allProfileUnits = [] } = useAllProfileUnits();
  const { data: allProfileFunctions = [] } = useAllProfileFunctions();
  
  // Mutations
  const updateProfileUnits = useUpdateProfileUnits();
  const updateProfileFunctions = useUpdateProfileFunctions();
  const linkLisLogin = useLinkLisLogin();

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
          lis_login: (profile as any).lis_login,
          lis_id: (profile as any).lis_id,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get user's units from profile_units
  const getUserUnits = (userId: string): ProfileUnit[] => {
    return allProfileUnits.filter(pu => pu.profile_id === userId);
  };

  // Get user's functions from profile_functions
  const getUserFunctions = (userId: string): ProfileFunction[] => {
    return allProfileFunctions.filter(pf => pf.profile_id === userId);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!u.name.toLowerCase().includes(search) && 
            !u.email.toLowerCase().includes(search) &&
            !(u.lis_login?.toLowerCase().includes(search))) {
          return false;
        }
      }
      
      // Role filter
      if (filterRole !== 'all') {
        if (filterRole === 'sem_perfil') {
          if (u.role) return false;
        } else if (u.role !== filterRole) {
          return false;
        }
      }
      
      // Unit filter
      if (filterUnit !== 'all') {
        const userUnits = getUserUnits(u.id);
        if (filterUnit === 'none') {
          if (userUnits.length > 0 || u.unit_id) return false;
        } else {
          if (!userUnits.some(pu => pu.unit_id === filterUnit) && u.unit_id !== filterUnit) return false;
        }
      }
      
      // Status filter
      if (filterStatus !== 'all') {
        const status = getUserStatus(u);
        if (filterStatus !== status) return false;
      }
      
      return true;
    });
  }, [users, searchTerm, filterRole, filterUnit, filterStatus, allProfileUnits]);

  const handleCreateUser = async (data: {
    email: string;
    name: string;
    password: string;
    role: AppRole;
    unitId: string;
  }) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name },
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
            role: data.role,
          });

        if (roleError) {
          console.error('Error adding role:', roleError);
        }

        // Update profile with unit_id and add to profile_units
        if (data.unitId) {
          await supabase
            .from('profiles')
            .update({ unit_id: data.unitId })
            .eq('id', authData.user.id);
          
          await supabase
            .from('profile_units')
            .insert({
              profile_id: authData.user.id,
              unit_id: data.unitId,
              is_primary: true,
            });
        }
      }

      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
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

  const handleToggleActive = async (targetUser: UserWithRole) => {
    const newStatus = targetUser.is_active === false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', targetUser.id);

      if (error) throw error;
      
      toast.success(newStatus ? 'Usuário reativado!' : 'Usuário suspenso!');
      setDeactivateUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const handleResendInvite = async (targetUser: UserWithRole) => {
    setResendingInvite(targetUser.id);
    try {
      // Use edge function to generate new reset link and send welcome email
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: { 
          email: targetUser.email,
          name: targetUser.name,
        }
      });

      if (error) throw error;
      
      toast.success('Email de convite enviado com sucesso!');
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast.error('Erro ao reenviar convite. Verifique se o email está correto.');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleEditUser = async (data: {
    lisLogin: string | null;
    lisId: number | null;
    unitIds: string[];
    primaryUnitId: string | null;
    functions: string[];
  }) => {
    if (!editingUser) return;
    
    setIsEditSubmitting(true);
    try {
      // Update LIS login
      await linkLisLogin.mutateAsync({
        profileId: editingUser.id,
        lisLogin: data.lisLogin,
        lisId: data.lisId,
      });
      
      // Update units
      await updateProfileUnits.mutateAsync({
        profileId: editingUser.id,
        unitIds: data.unitIds,
        primaryUnitId: data.primaryUnitId || undefined,
      });
      
      // Update functions
      await updateProfileFunctions.mutateAsync({
        profileId: editingUser.id,
        functions: data.functions,
      });
      
      toast.success('Usuário atualizado!');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setIsEditSubmitting(false);
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

  // Prepare data for edit dialog
  const editingUserUnits = editingUser ? getUserUnits(editingUser.id) : [];
  const editingUserUnitIds = editingUserUnits.map(pu => pu.unit_id);
  const editingUserPrimaryUnitId = editingUserUnits.find(pu => pu.is_primary)?.unit_id;
  const editingUserFunctions = editingUser ? getUserFunctions(editingUser.id).map(pf => pf.function) : [];

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
              <p className="text-muted-foreground">Gerencie os usuários e permissões do sistema</p>
            </div>
            
            <div className="flex gap-2">
              <RoleGuideModal />
              
              <Button 
                variant="outline" 
                onClick={() => setIsExcelImportOpen(true)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
              
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
                  <UserFormAdaptive
                    units={units}
                    isSubmitting={isSubmitting}
                    onSubmit={handleCreateUser}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Role Summary Panel */}
          <RoleSummaryPanel
            users={users}
            units={units}
            activeRoleFilter={filterRole}
            onRoleFilterChange={setFilterRole}
          />

          {/* Additional Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou login LIS..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
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
                    <SelectItem value="inactive">Suspensos</SelectItem>
                    <SelectItem value="invited">Convidados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Login LIS</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Funções</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map(u => {
                      const status = getUserStatus(u);
                      const statusConfig = getStatusConfig(status);
                      const lastAccessText = formatLastAccess(u.last_access);
                      const isInactive = status === 'inactive';
                      const isInvited = status === 'invited';
                      
                      const userUnits = getUserUnits(u.id);
                      const userFunctions = getUserFunctions(u.id);
                      const primaryUnit = userUnits.find(pu => pu.is_primary);
                      
                      return (
                        <TableRow key={u.id} className={isInactive ? 'opacity-60' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.lis_login ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="font-mono text-xs cursor-help">
                                    <Link2 className="w-3 h-3 mr-1" />
                                    {u.lis_login}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>ID LIS: {u.lis_id || 'N/A'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
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
                              <Badge variant="outline" className="border-destructive text-destructive">
                                Sem perfil
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {userUnits.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {userUnits.map(pu => {
                                  const unit = units.find(u => u.id === pu.unit_id);
                                  return (
                                    <Badge 
                                      key={pu.id} 
                                      variant={pu.is_primary ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {unit?.code || unit?.name?.substring(0, 3)}
                                      {pu.is_primary && <Star className="w-2 h-2 ml-1 fill-current" />}
                                    </Badge>
                                  );
                                })}
                              </div>
                            ) : u.unit ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                {u.unit.code || u.unit.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">Todas</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {userFunctions.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {userFunctions.map(pf => {
                                  const fnConfig = OPERATIONAL_FUNCTIONS.find(f => f.value === pf.function);
                                  return (
                                    <Tooltip key={pf.id}>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-xs cursor-help">
                                          <Briefcase className="w-2 h-2 mr-1" />
                                          {fnConfig?.label || pf.function}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{fnConfig?.description}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
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
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <span>Nunca</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {u.id !== user?.id && (
                              <div className="flex items-center justify-end gap-2">
                                {/* Edit Button */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => setEditingUser(u)}
                                      disabled={isInactive}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar unidades, funções e LIS</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                {/* Role selector */}
                                <Select
                                  value={u.role || ''}
                                  onValueChange={value => handleUpdateRole(u.id, value as AppRole)}
                                  disabled={isInactive}
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
                                
                                {/* Resend invite button for invited users */}
                                {isInvited && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleResendInvite(u)}
                                        disabled={resendingInvite === u.id}
                                      >
                                        {resendingInvite === u.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <MailPlus className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Reenviar convite</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                
                                {/* Suspend/Reactivate button */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={isInactive ? 'default' : 'outline'}
                                      size="icon"
                                      onClick={() => isInactive ? handleToggleActive(u) : setDeactivateUser(u)}
                                    >
                                      {isInactive ? (
                                        <UserCheck className="w-4 h-4" />
                                      ) : (
                                        <UserX className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isInactive ? 'Reativar usuário' : 'Suspender usuário'}</p>
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

        {/* Edit User Dialog */}
        <UserEditDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          units={units}
          currentUnitIds={editingUserUnitIds}
          primaryUnitId={editingUserPrimaryUnitId}
          currentFunctions={editingUserFunctions}
          isSubmitting={isEditSubmitting}
          onSubmit={handleEditUser}
          currentRole={editingUser?.role}
          onRoleChange={(role) => editingUser && handleUpdateRole(editingUser.id, role)}
          onStatusToggle={(userId, isActive) => {
            const targetUser = users.find(u => u.id === userId);
            if (targetUser) {
              if (isActive) {
                handleToggleActive({ ...targetUser, is_active: false });
              } else {
                setDeactivateUser(targetUser);
              }
            }
          }}
        />

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog open={!!deactivateUser} onOpenChange={() => setDeactivateUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspender Usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja suspender o usuário <strong>{deactivateUser?.name}</strong>?
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
                Suspender
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Excel Import Modal */}
        <ExcelImportModal
          open={isExcelImportOpen}
          onOpenChange={setIsExcelImportOpen}
          onSuccess={fetchUsers}
        />
      </TooltipProvider>
    </AppLayout>
  );
}
