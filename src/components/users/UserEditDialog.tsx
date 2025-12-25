import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Star, Building2, Briefcase, Link2 } from 'lucide-react';
import { Unit } from '@/types/database';
import { OPERATIONAL_FUNCTIONS } from '@/hooks/useProfileFunctions';
import { LisUser } from '@/hooks/useLisUsers';

interface UserForEdit {
  id: string;
  name: string;
  email: string;
  lis_login?: string | null;
  lis_id?: number | null;
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
      // If first unit, set as primary
      if (selectedUnits.length === 0) {
        setPrimaryUnit(unitId);
      }
    } else {
      setSelectedUnits(prev => prev.filter(id => id !== unitId));
      // If removing primary, clear it
      if (primaryUnit === unitId) {
        const remaining = selectedUnits.filter(id => id !== unitId);
        setPrimaryUnit(remaining[0] || '');
      }
    }
  };

  const handleFunctionToggle = (fn: string, checked: boolean) => {
    if (checked) {
      setSelectedFunctions(prev => [...prev, fn]);
    } else {
      setSelectedFunctions(prev => prev.filter(f => f !== fn));
    }
  };

  const handleLisUserSelect = (login: string) => {
    if (login === 'none') {
      setLisLogin('');
      setLisId(null);
    } else {
      const lisUser = unlinkedLisUsers.find(u => u.login === login);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        
        {user && (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* User Info (read-only) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Usuário</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <Separator />

              {/* LIS Login */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <Label>Login LIS</Label>
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

              <Separator />

              {/* Units Multi-select */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <Label>Unidades</Label>
                </div>
                <div className="space-y-2 border rounded-md p-3">
                  {units.map(unit => {
                    const isSelected = selectedUnits.includes(unit.id);
                    const isPrimary = primaryUnit === unit.id;
                    
                    return (
                      <div 
                        key={unit.id} 
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`unit-${unit.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => handleUnitToggle(unit.id, !!checked)}
                          />
                          <label 
                            htmlFor={`unit-${unit.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {unit.name}
                          </label>
                        </div>
                        {isSelected && (
                          <Button
                            type="button"
                            variant={isPrimary ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setPrimaryUnit(unit.id)}
                          >
                            <Star className={`w-3 h-3 ${isPrimary ? 'fill-current' : ''}`} />
                            {isPrimary && <span className="ml-1 text-xs">Principal</span>}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedUnits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
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
              </div>

              <Separator />

              {/* Operational Functions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <Label>Funções Operacionais</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funções desempenhadas no laboratório (diferente do perfil de acesso ao sistema)
                </p>
                <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                  {OPERATIONAL_FUNCTIONS.map(fn => {
                    const isSelected = selectedFunctions.includes(fn.value);
                    
                    return (
                      <div key={fn.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`fn-${fn.value}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleFunctionToggle(fn.value, !!checked)}
                        />
                        <label 
                          htmlFor={`fn-${fn.value}`}
                          className="text-sm cursor-pointer"
                          title={fn.description}
                        >
                          {fn.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {selectedFunctions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
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
              </div>

              <Separator />

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
