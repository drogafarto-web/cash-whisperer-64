import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, AlertTriangle } from 'lucide-react';
import { ROLE_CONFIG } from '@/lib/access-policy';
import { AppRole, Unit } from '@/types/database';
import { cn } from '@/lib/utils';

interface UserWithRole {
  id: string;
  role?: AppRole;
  unit_id?: string | null;
  is_active?: boolean;
  last_access?: string | null;
}

interface RoleSummaryPanelProps {
  users: UserWithRole[];
  units: Unit[];
  activeRoleFilter: string;
  onRoleFilterChange: (role: string) => void;
}

export function RoleSummaryPanel({ 
  users, 
  units, 
  activeRoleFilter, 
  onRoleFilterChange 
}: RoleSummaryPanelProps) {
  // Contagem de usuários por papel
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeUsers = users.filter(u => u.is_active !== false);
    
    for (const role of Object.keys(ROLE_CONFIG)) {
      counts[role] = activeUsers.filter(u => u.role === role).length;
    }
    counts['sem_perfil'] = activeUsers.filter(u => !u.role).length;
    
    return counts;
  }, [users]);

  // Contagem de convidados (nunca fizeram login)
  const invitedCount = useMemo(() => {
    return users.filter(u => u.is_active !== false && !u.last_access).length;
  }, [users]);

  // Alertas de cobertura
  const alerts = useMemo(() => {
    const warnings: string[] = [];
    
    // Verificar se há unidades sem gestor
    const unitsWithGestor = new Set(
      users
        .filter(u => u.role === 'gestor_unidade' && u.is_active !== false && u.unit_id)
        .map(u => u.unit_id)
    );
    const unitsWithoutGestor = units.filter(u => !unitsWithGestor.has(u.id));
    if (unitsWithoutGestor.length > 0) {
      warnings.push(`${unitsWithoutGestor.length} unidade(s) sem gestor atribuído`);
    }
    
    // Verificar se só tem 1 financeiro
    if (roleCounts['financeiro'] === 1) {
      warnings.push('Apenas 1 usuário Financeiro – considere backup');
    }
    
    // Verificar se não tem admin
    if (roleCounts['admin'] === 0) {
      warnings.push('Nenhum Administrador ativo!');
    }
    
    return warnings;
  }, [users, units, roleCounts]);

  const totalActive = users.filter(u => u.is_active !== false).length;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Total */}
            <div className="flex items-center gap-2 pr-4 border-r border-border">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{totalActive} usuários</span>
              {invitedCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {invitedCount} convidado(s)
                </Badge>
              )}
            </div>
            
            {/* Role chips como filtros */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={activeRoleFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => onRoleFilterChange('all')}
              >
                Todos
              </Badge>
              {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                const count = roleCounts[role] || 0;
                const isActive = activeRoleFilter === role;
                
                return (
                  <Badge
                    key={role}
                    variant={isActive ? 'default' : config.variant}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isActive ? 'ring-2 ring-primary ring-offset-2' : 'hover:opacity-80'
                    )}
                    onClick={() => onRoleFilterChange(role)}
                  >
                    {config.label}: {count}
                  </Badge>
                );
              })}
              {roleCounts['sem_perfil'] > 0 && (
                <Badge
                  variant={activeRoleFilter === 'sem_perfil' ? 'default' : 'outline'}
                  className="cursor-pointer hover:opacity-80 transition-colors border-destructive text-destructive"
                  onClick={() => onRoleFilterChange('sem_perfil')}
                >
                  Sem perfil: {roleCounts['sem_perfil']}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de cobertura */}
      {alerts.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap gap-x-4 gap-y-1">
            {alerts.map((alert, i) => (
              <span key={i} className="text-sm">• {alert}</span>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
