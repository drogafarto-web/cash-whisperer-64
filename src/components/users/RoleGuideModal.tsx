import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Check, Eye, X } from 'lucide-react';
import { ROLE_CONFIG, ROLE_PERMISSIONS, AREA_LABELS, AREA_GROUPS, PermissionLevel } from '@/lib/access-policy';
import { AppRole } from '@/types/database';
import { cn } from '@/lib/utils';

interface RoleGuideModalProps {
  trigger?: React.ReactNode;
}

function PermissionIcon({ level }: { level: PermissionLevel }) {
  switch (level) {
    case 'full':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'edit':
      return <Check className="w-4 h-4 text-blue-600" />;
    case 'view':
      return <Eye className="w-4 h-4 text-muted-foreground" />;
    case 'none':
    default:
      return <X className="w-4 h-4 text-muted-foreground/40" />;
  }
}

function PermissionCell({ level }: { level: PermissionLevel }) {
  return (
    <td className={cn(
      'text-center p-2 border-b border-border',
      level === 'full' && 'bg-green-50 dark:bg-green-900/20',
      level === 'edit' && 'bg-blue-50 dark:bg-blue-900/20',
      level === 'view' && 'bg-muted/30',
    )}>
      <div className="flex items-center justify-center">
        <PermissionIcon level={level} />
      </div>
    </td>
  );
}

export function RoleGuideModal({ trigger }: RoleGuideModalProps) {
  const roles = Object.keys(ROLE_CONFIG) as AppRole[];
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <BookOpen className="w-4 h-4 mr-2" />
            Guia de Papéis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Guia de Papéis e Permissões
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {/* Legenda */}
          <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 bg-green-50 dark:bg-green-900/20 rounded flex items-center justify-center">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              <span>Acesso total</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center">
                <Check className="w-3 h-3 text-blue-600" />
              </div>
              <span>Pode editar</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 bg-muted/50 rounded flex items-center justify-center">
                <Eye className="w-3 h-3 text-muted-foreground" />
              </div>
              <span>Apenas visualizar</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 bg-background rounded flex items-center justify-center border">
                <X className="w-3 h-3 text-muted-foreground/40" />
              </div>
              <span>Sem acesso</span>
            </div>
          </div>

          {/* Descrição dos papéis */}
          <div className="mb-6 space-y-2">
            <h3 className="font-semibold text-sm">Descrição dos Papéis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {roles.map(role => (
                <div key={role} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <Badge variant={ROLE_CONFIG[role].variant} className="shrink-0 mt-0.5">
                    {ROLE_CONFIG[role].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_CONFIG[role].description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Matriz de permissões */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2 border-b border-border font-medium">Área</th>
                  {roles.map(role => (
                    <th key={role} className="text-center p-2 border-b border-border font-medium whitespace-nowrap">
                      <Badge variant={ROLE_CONFIG[role].variant} className="text-xs">
                        {ROLE_CONFIG[role].label}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Operacional */}
                <tr>
                  <td colSpan={roles.length + 1} className="bg-muted/30 p-2 font-semibold text-xs uppercase tracking-wide">
                    Operacional
                  </td>
                </tr>
                {AREA_GROUPS.operacional.map(area => (
                  <tr key={area} className="hover:bg-muted/20">
                    <td className="p-2 border-b border-border">{AREA_LABELS[area]}</td>
                    {roles.map(role => (
                      <PermissionCell key={role} level={ROLE_PERMISSIONS[role][area]} />
                    ))}
                  </tr>
                ))}
                
                {/* Relatórios */}
                <tr>
                  <td colSpan={roles.length + 1} className="bg-muted/30 p-2 font-semibold text-xs uppercase tracking-wide">
                    Relatórios & Contas
                  </td>
                </tr>
                {AREA_GROUPS.relatorios.map(area => (
                  <tr key={area} className="hover:bg-muted/20">
                    <td className="p-2 border-b border-border">{AREA_LABELS[area]}</td>
                    {roles.map(role => (
                      <PermissionCell key={role} level={ROLE_PERMISSIONS[role][area]} />
                    ))}
                  </tr>
                ))}
                
                {/* Fiscal */}
                <tr>
                  <td colSpan={roles.length + 1} className="bg-muted/30 p-2 font-semibold text-xs uppercase tracking-wide">
                    Fiscal & Tributário
                  </td>
                </tr>
                {AREA_GROUPS.fiscal.map(area => (
                  <tr key={area} className="hover:bg-muted/20">
                    <td className="p-2 border-b border-border">{AREA_LABELS[area]}</td>
                    {roles.map(role => (
                      <PermissionCell key={role} level={ROLE_PERMISSIONS[role][area]} />
                    ))}
                  </tr>
                ))}
                
                {/* Admin */}
                <tr>
                  <td colSpan={roles.length + 1} className="bg-muted/30 p-2 font-semibold text-xs uppercase tracking-wide">
                    Administração
                  </td>
                </tr>
                {AREA_GROUPS.admin.map(area => (
                  <tr key={area} className="hover:bg-muted/20">
                    <td className="p-2 border-b border-border">{AREA_LABELS[area]}</td>
                    {roles.map(role => (
                      <PermissionCell key={role} level={ROLE_PERMISSIONS[role][area]} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notas */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
            <p><strong>Observações:</strong></p>
            <p>• <strong>Gestor de Unidade</strong> e <strong>Atendente</strong> vêem apenas dados da própria unidade.</p>
            <p>• <strong>Contador</strong> foca na base fiscal e cenários, sem acesso à operação diária.</p>
            <p>• <strong>Financeiro</strong> gerencia pagamentos e conciliação, sem configurar tributos.</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
