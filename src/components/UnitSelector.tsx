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
import { Building2 } from 'lucide-react';

interface UnitSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showAllOption?: boolean;
  className?: string;
}

export function UnitSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Selecione a unidade...',
  showAllOption = false,
  className,
}: UnitSelectorProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnits = async () => {
      const { data } = await supabase
        .from('units')
        .select('*')
        .order('name');
      
      setUnits((data || []) as Unit[]);
      setIsLoading(false);
    };

    fetchUnits();
  }, []);

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
