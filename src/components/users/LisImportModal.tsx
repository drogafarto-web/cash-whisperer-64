import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, UserPlus, Link2, User } from 'lucide-react';
import { LisUser, useLinkLisLogin } from '@/hooks/useLisUsers';

interface LisImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unlinkedLisUsers: LisUser[];
  existingUsers: { id: string; name: string; email: string; lis_login?: string | null }[];
  onSuccess: () => void;
}

export function LisImportModal({
  open,
  onOpenChange,
  unlinkedLisUsers,
  existingUsers,
  onSuccess,
}: LisImportModalProps) {
  const [selectedOperators, setSelectedOperators] = useState<Set<string>>(new Set());
  const [linkMappings, setLinkMappings] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const linkLisLogin = useLinkLisLogin();

  const handleToggleOperator = (lisUserId: string) => {
    const newSelected = new Set(selectedOperators);
    if (newSelected.has(lisUserId)) {
      newSelected.delete(lisUserId);
      // Clear mapping
      const newMappings = { ...linkMappings };
      delete newMappings[lisUserId];
      setLinkMappings(newMappings);
    } else {
      newSelected.add(lisUserId);
    }
    setSelectedOperators(newSelected);
  };

  const handleSetMapping = (lisUserId: string, profileId: string) => {
    setLinkMappings(prev => ({
      ...prev,
      [lisUserId]: profileId,
    }));
  };

  const handleSubmit = async () => {
    const toLink = Array.from(selectedOperators)
      .filter(id => linkMappings[id])
      .map(lisUserId => {
        const lisUser = unlinkedLisUsers.find(u => u.id === lisUserId);
        const profileId = linkMappings[lisUserId];
        return { lisUser, profileId };
      })
      .filter(item => item.lisUser && item.profileId);

    if (toLink.length === 0) {
      toast.error('Selecione ao menos um operador e vincule a um usuário');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const { lisUser, profileId } of toLink) {
        await linkLisLogin.mutateAsync({
          profileId,
          lisLogin: lisUser!.login,
          lisId: lisUser!.lis_id,
        });
      }

      toast.success(`${toLink.length} operador(es) vinculado(s) com sucesso!`);
      setSelectedOperators(new Set());
      setLinkMappings({});
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking operators:', error);
      toast.error('Erro ao vincular operadores');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter users that don't already have a LIS login
  const availableUsers = existingUsers.filter(u => !u.lis_login);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Vincular Operadores LIS
          </DialogTitle>
          <DialogDescription>
            Vincule operadores do LIS a usuários existentes no sistema. Apenas operadores ativos e sem vínculo são mostrados.
          </DialogDescription>
        </DialogHeader>

        {unlinkedLisUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Todos os operadores LIS já estão vinculados!</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {unlinkedLisUsers.map(lisUser => {
                  const isSelected = selectedOperators.has(lisUser.id);
                  const linkedTo = linkMappings[lisUser.id];
                  
                  return (
                    <div
                      key={lisUser.id}
                      className={`p-3 border rounded-lg transition-colors ${
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
                          
                          {isSelected && (
                            <div className="mt-2">
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                Vincular ao usuário:
                              </Label>
                              <Select
                                value={linkedTo || ''}
                                onValueChange={(value) => handleSetMapping(lisUser.id, value)}
                              >
                                <SelectTrigger className="w-full">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedOperators.size} selecionado(s), {Object.keys(linkMappings).length} vinculado(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || Object.keys(linkMappings).length === 0}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Vincular Selecionados
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
