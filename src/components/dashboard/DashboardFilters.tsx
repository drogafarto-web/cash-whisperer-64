import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type PeriodType = 'current' | '3m' | '12m';
export type ViewLevel = 'consolidated' | 'by_unit';

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface DashboardFiltersProps {
  units: Unit[];
  selectedUnit: string;
  onUnitChange: (value: string) => void;
  period: PeriodType;
  onPeriodChange: (value: PeriodType) => void;
  viewLevel: ViewLevel;
  onViewLevelChange: (value: ViewLevel) => void;
}

export function DashboardFilters({
  units,
  selectedUnit,
  onUnitChange,
  period,
  onPeriodChange,
  viewLevel,
  onViewLevelChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 p-4 rounded-lg border bg-card">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Unidade</Label>
        <Select value={selectedUnit} onValueChange={onUnitChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedUnit === 'all' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Nível de detalhe</Label>
          <Select value={viewLevel} onValueChange={(v) => onViewLevelChange(v as ViewLevel)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidated">Consolidado</SelectItem>
              <SelectItem value="by_unit">Por unidade</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
