import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ROLE_CONFIG, ROLE_PERMISSIONS, AREA_LABELS, SystemArea } from '@/lib/access-policy';
import { AppRole, Unit } from '@/types/database';
import { Loader2, HelpCircle, Info } from 'lucide-react';
import { RoleSelector } from './RoleSelector';

interface UserFormAdaptiveProps {
  units: Unit[];
  isSubmitting: boolean;
  onSubmit: (data: {
    email: string;
    name: string;
    password: string;
    role: AppRole;
    unitId: string;
  }) => Promise<void>;
}

export function UserFormAdaptive({ units, isSubmitting, onSubmit }: UserFormAdaptiveProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('secretaria');
  const [unitId, setUnitId] = useState<string>('');

  const roleConfig = ROLE_CONFIG[role];
  const requiresUnit = roleConfig.requiresUnit;

  // Resetar unidade quando mudar para papel que não precisa
  useEffect(() => {
    if (!requiresUnit) {
      setUnitId('');
    }
  }, [role, requiresUnit]);

  // Áreas que o papel terá acesso
  const accessibleAreas = Object.entries(ROLE_PERMISSIONS[role])
    .filter(([, level]) => level !== 'none')
    .map(([area]) => area as SystemArea);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ email, name, password, role, unitId });
    // Reset form
    setEmail('');
    setName('');
    setPassword('');
    setRole('secretaria');
    setUnitId('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Passo 1: Escolher o papel primeiro */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">1. Escolha o Perfil</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>O perfil define quais módulos e ações o usuário poderá acessar</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <RoleSelector value={role} onChange={setRole} />
      </div>

      {/* Preview do que o usuário verá */}
      <Alert className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <span className="font-medium">Este usuário terá acesso a:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {accessibleAreas.slice(0, 6).map(area => (
              <Badge key={area} variant="outline" className="text-xs">
                {AREA_LABELS[area]}
              </Badge>
            ))}
            {accessibleAreas.length > 6 && (
              <Badge variant="outline" className="text-xs">
                +{accessibleAreas.length - 6} mais
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Passo 2: Dados do usuário */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">2. Dados do Usuário</Label>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-sm">Senha</Label>
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
        </div>
      </div>

      {/* Passo 3: Unidade (condicional) */}
      {requiresUnit && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-base font-semibold">3. Vincular Unidade</Label>
            <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
          </div>
          <Select
            value={unitId}
            onValueChange={setUnitId}
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a unidade..." />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O usuário só terá acesso aos dados desta unidade
          </p>
        </div>
      )}

      {/* Passo opcional: Unidade para papéis que não requerem */}
      {!requiresUnit && role !== 'admin' && role !== 'contador' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Vincular a uma unidade (opcional)</Label>
          </div>
          <Select
            value={unitId || 'all'}
            onValueChange={(value) => setUnitId(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-full">
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
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isSubmitting || (requiresUnit && !unitId)}
      >
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Criar Usuário
      </Button>
    </form>
  );
}
