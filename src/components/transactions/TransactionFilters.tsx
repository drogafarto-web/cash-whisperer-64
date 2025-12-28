import { Card } from '@/components/ui/card';
import { UnitSelector } from '@/components/UnitSelector';
import { Filter } from 'lucide-react';

export interface TransactionFiltersProps {
  filterUnitId: string;
  onFilterChange: (unitId: string) => void;
}

export function TransactionFilters({
  filterUnitId,
  onFilterChange,
}: TransactionFiltersProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1 max-w-xs">
          <UnitSelector
            value={filterUnitId}
            onChange={onFilterChange}
            showAllOption
            placeholder="Filtrar por unidade..."
          />
        </div>
      </div>
    </Card>
  );
}
