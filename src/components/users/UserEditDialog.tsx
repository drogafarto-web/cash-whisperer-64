import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Star, Building2, Briefcase, Link2, Check, Shield } from 'lucide-react';
import { Unit, AppRole } from '@/types/database';
import { OPERATIONAL_FUNCTIONS } from '@/hooks/useProfileFunctions';
import { LisUser } from '@/hooks/useLisUsers';
import { ROLE_CONFIG } from '@/lib/access-policy';
import { cn } from '@/lib/utils';

interface UserForEdit {
  id: string;
  name: string;
  email: string;
  lis_login?: string | null;
  lis_id?: number | null;
  is_active?: boolean;
}

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserForEdit | null;
  units: Unit[];
  unlinkedLisUsers: LisUser[];
  currentUnitIds: string[];
  primaryUnitId?: string;
  currentFunctions: string[];
  isSubmitting: boolean;
  onSubmit: (data: {
    lisLogin: string | null;
    lisId: number | null;
    unitIds: string[];
    primaryUnitId: string | null;
    functions: string[];
  }) => Promise<void>;
  // New optional props for role management
  currentRole?: AppRole | null;
  onRoleChange?: (role: AppRole) => void;
  onStatusToggle?: (userId: string, isActive: boolean) => void;
}

export function UserEditDialog({
  open,
  onOpenChange,
  user,
  units,
  unlinkedLisUsers,
  currentUnitIds,
  primaryUnitId: initialPrimaryUnitId,
  currentFunctions,
  isSubmitting,
  onSubmit,
  currentRole,
  onRoleChange,
  onStatusToggle,
}: UserEditDialogProps) {
  const [lisLogin, setLisLogin] = useState<string>('');
  const [lisId, setLisId] = useState<number | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [primaryUnit, setPrimaryUnit] = useState<string>('');
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setLisLogin(user.lis_login || '');
      setLisId(user.lis_id || null);
      setSelectedUnits(currentUnitIds);
      setPrimaryUnit(initialPrimaryUnitId || '');
      setSelectedFunctions(currentFunctions);
    }
  }, [user, currentUnitIds, initialPrimaryUnitId, currentFunctions]);

  const handleUnitToggle = (unitId: string, checked: boolean) => {
    if (checked) {
      setSelectedUnits(prev => [...prev, unitId]);
      if (selectedUnits.length === 0) {
        setPrimaryUnit(unitId);
      }
    } else {
      setSelectedUnits(prev => prev.filter(id => id !== unitId));
      if (primaryUnit === unitId) {
        const remaining = selectedUnits.filter(id => id !== unitId);
        setPrimaryUnit(remaining[0] || '');
      }
    }
  };

  const handleFunctionToggle = (fn: string) => {
    setSelectedFunctions(prev => 
      prev.includes(fn) ? prev.filter(f => f !== fn) : [...prev, fn]
    );
  };

  const handleLisUserSelect = (login: string) => {
    if (login === 'none') {
      setLisLogin('');
      setLisId(null);
    } else {
      const lisUser = lisUserOptions.find(u => u.login === login);
      if (lisUser) {
        setLisLogin(lisUser.login);
        setLisId(lisUser.lis_id);
      }
    }
  };

  const handleSubmit = async () => {
    await onSubmit({
      lisLogin: lisLogin || null,
      lisId,
      unitIds: selectedUnits,
      primaryUnitId: primaryUnit || null,
      functions: selectedFunctions,
    });
  };

  // Include current user's lis_login in options if it exists
  const lisUserOptions = [...unlinkedLisUsers];
  if (user?.lis_login && !lisUserOptions.find(u => u.login === user.lis_login)) {
    lisUserOptions.unshift({
      id: 'current',
      lis_id: user.lis_id || null,
      login: user.lis_login,
      nome: user.lis_login,
      active: true,
      created_at: '',
      updated_at: '',
    });
  }

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const isActive = user?.is_active !== false;

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        {/* Header with Save button */}
        <DialogHeader className="flex flex-row items-center justify-between p-6 pb-0">
          <DialogTitle>Editar Usuário</DialogTitle>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-6 pt-4 space-y-6">
            {/* User Header Card */}
            <div className="flex flex-col items-center py-4 border rounded-lg bg-muted/30">
              <div className="relative">
                <Avatar className="w-20 h-20 mb-3">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute bottom-3 right-0 w-4 h-4 rounded-full border-2 border-background",
                  isActive ? "bg-emerald-500" : "bg-muted-foreground"
                )} />
              </div>
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              
              {/* Status Toggle */}
              {onStatusToggle && (
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant={isActive ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => !isActive && onStatusToggle(user.id, true)}
                    disabled={isActive}
                  >
                    Ativo
                  </Button>
                  <Button 
                    variant={!isActive ? 'secondary' : 'outline'} 
                    size="sm"
                    onClick={() => isActive && onStatusToggle(user.id, false)}
                    disabled={!isActive}
                  >
                    Suspenso
                  </Button>
                </div>
              )}
            </div>

            {/* LIS Login Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <Label className="font-medium">Login LIS</Label>
              </div>
              <Select value={lisLogin || 'none'} onValueChange={handleLisUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um operador LIS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {lisUserOptions.map(lisUser => (
                    <SelectItem key={lisUser.login} value={lisUser.login}>
                      {lisUser.login} - {lisUser.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lisLogin && (
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    Login: {lisLogin}
                  </Badge>
                  {lisId && (
                    <Badge variant="secondary" className="text-xs">
                      ID LIS: {lisId}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Role Selection Cards */}
            {onRoleChange && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Perfil de Acesso</Label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
                    const isSelected = currentRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => onRoleChange(roleKey as AppRole)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          isSelected 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-muted hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                            isSelected 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground"
                          )}>
                            {isSelected && <Check className="w-2 h-2 text-primary-foreground" />}
                          </div>
                          <span className="font-medium text-sm">{config.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {config.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs: Units & Functions */}
            <Tabs defaultValue="units" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="units" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Unidades
                  {selectedUnits.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {selectedUnits.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="functions" className="gap-2">
                  <Briefcase className="w-4 h-4" />
                  Funções
                  {selectedFunctions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {selectedFunctions.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="units" className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead className="w-[90px] text-center">Principal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map(unit => {
                        const isSelected = selectedUnits.includes(unit.id);
                        const isPrimary = primaryUnit === unit.id;
                        
                        return (
                          <TableRow key={unit.id}>
                            <TableCell className="text-center">
                              <Checkbox
                                id={`unit-${unit.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => handleUnitToggle(unit.id, !!checked)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <label 
                                htmlFor={`unit-${unit.id}`}
                                className="cursor-pointer"
                              >
                                {unit.name}
                              </label>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(unit as any).municipio_nome || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {isSelected && (
                                <Button
                                  type="button"
                                  variant={isPrimary ? 'default' : 'ghost'}
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setPrimaryUnit(unit.id)}
                                >
                                  <Star className={cn("w-4 h-4", isPrimary && "fill-current")} />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Selected units as chips */}
                {selectedUnits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm text-muted-foreground mr-2">Selecionadas:</span>
                    {selectedUnits.map(unitId => {
                      const unit = units.find(u => u.id === unitId);
                      const isPrimary = primaryUnit === unitId;
                      return (
                        <Badge 
                          key={unitId} 
                          variant={isPrimary ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {unit?.code || unit?.name}
                          {isPrimary && <Star className="w-2 h-2 ml-1 fill-current" />}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="functions" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Funções desempenhadas no laboratório (diferente do perfil de acesso ao sistema)
                </p>
                <div className="flex flex-wrap gap-2">
                  {OPERATIONAL_FUNCTIONS.map(fn => {
                    const isSelected = selectedFunctions.includes(fn.value);
                    return (
                      <Button
                        key={fn.value}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFunctionToggle(fn.value)}
                        title={fn.description}
                        className="gap-1"
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {fn.label}
                      </Button>
                    );
                  })}
                </div>
                
                {/* Selected functions as badges */}
                {selectedFunctions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    <span className="text-sm text-muted-foreground mr-2">Selecionadas:</span>
                    {selectedFunctions.map(fn => {
                      const fnConfig = OPERATIONAL_FUNCTIONS.find(f => f.value === fn);
                      return (
                        <Badge key={fn} variant="outline" className="text-xs">
                          {fnConfig?.label || fn}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Footer with Cancel button */}
            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
