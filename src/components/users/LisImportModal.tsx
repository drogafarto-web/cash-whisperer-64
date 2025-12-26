import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, UserPlus, Link2, User, Plus, Mail } from 'lucide-react';
import { LisUser, useLinkLisLogin, useCreateUserFromLis } from '@/hooks/useLisUsers';
import { ROLE_CONFIG, AppRole } from '@/lib/access-policy';

interface Unit {
  id: string;
  name: string;
  code?: string;
}

interface LisImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unlinkedLisUsers: LisUser[];
  existingUsers: { id: string; name: string; email: string; lis_login?: string | null }[];
  units: Unit[];
  onSuccess: () => void;
}

type ActionType = 'create' | 'link';

interface OperatorConfig {
  action: ActionType;
  // For 'create' action
  email: string;
  role: AppRole;
  unitId: string;
  // For 'link' action
  linkedProfileId: string;
}

export function LisImportModal({
  open,
  onOpenChange,
  unlinkedLisUsers,
  existingUsers,
  units,
  onSuccess,
}: LisImportModalProps) {
  const [selectedOperators, setSelectedOperators] = useState<Set<string>>(new Set());
  const [operatorConfigs, setOperatorConfigs] = useState<Record<string, OperatorConfig>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const linkLisLogin = useLinkLisLogin();
  const createUserFromLis = useCreateUserFromLis();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOperators(new Set());
      setOperatorConfigs({});
    }
  }, [open]);

  const handleToggleOperator = (lisUserId: string) => {
    const newSelected = new Set(selectedOperators);
    if (newSelected.has(lisUserId)) {
      newSelected.delete(lisUserId);
      const newConfigs = { ...operatorConfigs };
      delete newConfigs[lisUserId];
      setOperatorConfigs(newConfigs);
    } else {
      newSelected.add(lisUserId);
      // Initialize with default config
      const defaultConfig: OperatorConfig = {
        action: 'create',
        email: '',
        role: 'secretaria' as AppRole,
        unitId: units[0]?.id || '',
        linkedProfileId: '',
      };
      setOperatorConfigs(prev => ({
        ...prev,
        [lisUserId]: defaultConfig,
      }));
    }
    setSelectedOperators(newSelected);
  };

  const handleConfigChange = (lisUserId: string, updates: Partial<OperatorConfig>) => {
    setOperatorConfigs(prev => ({
      ...prev,
      [lisUserId]: {
        ...prev[lisUserId],
        ...updates,
      },
    }));
  };

  const isConfigValid = (lisUserId: string): boolean => {
    const config = operatorConfigs[lisUserId];
    if (!config) return false;
    
    if (config.action === 'create') {
      return !!(config.email && config.email.includes('@') && config.role && config.unitId);
    } else {
      return !!config.linkedProfileId;
    }
  };

  const handleSubmit = async () => {
    const toProcess = Array.from(selectedOperators)
      .filter(id => isConfigValid(id))
      .map(lisUserId => ({
        lisUser: unlinkedLisUsers.find(u => u.id === lisUserId)!,
        config: operatorConfigs[lisUserId],
      }))
      .filter(item => item.lisUser);

    if (toProcess.length === 0) {
      toast.error('Preencha os dados de ao menos um operador selecionado');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const { lisUser, config } of toProcess) {
        try {
          if (config.action === 'create') {
            // Create new user from LIS
            await createUserFromLis.mutateAsync({
              lis_login: lisUser.login,
              lis_id: lisUser.lis_id,
              nome: lisUser.nome,
              email: config.email,
              role: config.role,
              unit_id: config.unitId,
            });
            successCount++;
          } else {
            // Link to existing user
            await linkLisLogin.mutateAsync({
              profileId: config.linkedProfileId,
              lisLogin: lisUser.login,
              lisId: lisUser.lis_id,
            });
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing ${lisUser.login}:`, error);
          errorCount++;
          toast.error(`Erro ao processar ${lisUser.login}: ${(error as Error).message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} operador(es) importado(s) com sucesso!`);
        onSuccess();
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter users that don't already have a LIS login
  const availableUsers = existingUsers.filter(u => !u.lis_login);

  const validCount = Array.from(selectedOperators).filter(id => isConfigValid(id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Importar Operadores LIS
          </DialogTitle>
          <DialogDescription>
            Selecione operadores do LIS para criar novos usuários ou vincular a usuários existentes.
          </DialogDescription>
        </DialogHeader>

        {unlinkedLisUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Todos os operadores LIS já estão vinculados!</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-4">
                {unlinkedLisUsers.map(lisUser => {
                  const isSelected = selectedOperators.has(lisUser.id);
                  const config = operatorConfigs[lisUser.id];
                  
                  return (
                    <div
                      key={lisUser.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`operator-${lisUser.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleOperator(lisUser.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`operator-${lisUser.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Badge variant="outline" className="font-mono">
                              {lisUser.login}
                            </Badge>
                            <span className="font-medium">{lisUser.nome}</span>
                            {lisUser.lis_id && (
                              <span className="text-xs text-muted-foreground">
                                (ID: {lisUser.lis_id})
                              </span>
                            )}
                          </Label>
                          
                          {isSelected && config && (
                            <div className="mt-4 space-y-4 pl-1">
                              {/* Action selection */}
                              <RadioGroup
                                value={config.action}
                                onValueChange={(value: ActionType) => 
                                  handleConfigChange(lisUser.id, { action: value })
                                }
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="create" id={`create-${lisUser.id}`} />
                                  <Label htmlFor={`create-${lisUser.id}`} className="flex items-center gap-1 cursor-pointer">
                                    <Plus className="w-3 h-3" />
                                    Criar novo usuário
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="link" id={`link-${lisUser.id}`} />
                                  <Label htmlFor={`link-${lisUser.id}`} className="flex items-center gap-1 cursor-pointer">
                                    <Link2 className="w-3 h-3" />
                                    Vincular a existente
                                  </Label>
                                </div>
                              </RadioGroup>

                              {config.action === 'create' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/50 rounded-md">
                                  {/* Email */}
                                  <div className="space-y-1">
                                    <Label className="text-xs">Email *</Label>
                                    <div className="relative">
                                      <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        type="email"
                                        placeholder="email@labclin.com"
                                        value={config.email}
                                        onChange={(e) => handleConfigChange(lisUser.id, { email: e.target.value })}
                                        className="pl-8"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Role */}
                                  <div className="space-y-1">
                                    <Label className="text-xs">Perfil *</Label>
                                    <Select
                                      value={config.role}
                                      onValueChange={(value: AppRole) => 
                                        handleConfigChange(lisUser.id, { role: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                                          <SelectItem key={key} value={key}>
                                            {cfg.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* Unit */}
                                  <div className="space-y-1">
                                    <Label className="text-xs">Unidade *</Label>
                                    <Select
                                      value={config.unitId}
                                      onValueChange={(value) => 
                                        handleConfigChange(lisUser.id, { unitId: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {units.map(unit => (
                                          <SelectItem key={unit.id} value={unit.id}>
                                            {unit.code || unit.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-muted/50 rounded-md">
                                  <Label className="text-xs mb-1 block">Vincular ao usuário:</Label>
                                  <Select
                                    value={config.linkedProfileId}
                                    onValueChange={(value) => 
                                      handleConfigChange(lisUser.id, { linkedProfileId: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione um usuário..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableUsers.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                          Nenhum usuário disponível
                                        </SelectItem>
                                      ) : (
                                        availableUsers.map(user => (
                                          <SelectItem key={user.id} value={user.id}>
                                            <div className="flex flex-col">
                                              <span>{user.name}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {user.email}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedOperators.size} selecionado(s), {validCount} pronto(s) para importar
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || validCount === 0}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Importar {validCount > 0 ? `(${validCount})` : ''}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
