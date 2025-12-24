import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Unit } from '@/types/database';
import { Building2, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface UnitSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showAllOption?: boolean;
  className?: string;
  /**
   * Se true, o seletor mostra apenas a unidade do usuário logado
   * e fica desabilitado. Útil para usuários operacionais.
   */
  restrictToUserUnit?: boolean;
}

export function UnitSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Selecione a unidade...',
  showAllOption = false,
  className,
  restrictToUserUnit = false,
}: UnitSelectorProps) {
  const { unit: userUnit, canAccessAllUnits } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Se restrictToUserUnit=true E usuário tem unidade fixa, travar na unidade do usuário
  const shouldRestrict = restrictToUserUnit && userUnit && !canAccessAllUnits;

  useEffect(() => {
    // Se está restrito, não precisa buscar outras unidades
    if (shouldRestrict && userUnit) {
      setUnits([userUnit]);
      setIsLoading(false);
      // Auto-selecionar a unidade do usuário se valor estiver vazio
      if (!value && userUnit.id) {
        onChange(userUnit.id);
      }
      return;
    }

    const fetchUnits = async () => {
      const { data } = await supabase
        .from('units')
        .select('*')
        .order('name');
      
      setUnits((data || []) as Unit[]);
      setIsLoading(false);
    };

    fetchUnits();
  }, [shouldRestrict, userUnit, value, onChange]);

  // Se restrito à unidade do usuário, mostrar label travada
  if (shouldRestrict && userUnit) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 ${className || ''}`}>
        <Lock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{userUnit.name}</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <SelectValue placeholder={isLoading ? 'Carregando...' : placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="all">Todas as unidades</SelectItem>
        )}
        {units.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            {unit.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
