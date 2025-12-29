import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, X, Clock } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PayablesFiltersExtendedProps {
  // Period filter (quick select)
  periodDays: string;
  onPeriodDaysChange: (value: string) => void;
  // Beneficiario search
  beneficiario: string;
  onBeneficiarioChange: (value: string) => void;
  // Unit filter
  unitId: string;
  onUnitIdChange: (value: string) => void;
  units: Array<{ id: string; name: string }>;
  // Payment account filter
  paymentAccountId: string;
  onPaymentAccountIdChange: (value: string) => void;
  accounts: Array<{ id: string; name: string; institution?: string | null }>;
  // Clear
  onClear: () => void;
}

export function PayablesFiltersExtended({
  periodDays,
  onPeriodDaysChange,
  beneficiario,
  onBeneficiarioChange,
  unitId,
  onUnitIdChange,
  units,
  paymentAccountId,
  onPaymentAccountIdChange,
  accounts,
  onClear,
}: PayablesFiltersExtendedProps) {
  const hasFilters =
    periodDays !== 'all' || beneficiario || (unitId && unitId !== 'all') || (paymentAccountId && paymentAccountId !== 'all');

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
      {/* Period Quick Select */}
      <Select value={periodDays} onValueChange={onPeriodDaysChange}>
        <SelectTrigger className="w-[180px]">
          <Clock className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="0">Vencidos + Hoje</SelectItem>
          <SelectItem value="7">Próximos 7 dias</SelectItem>
          <SelectItem value="30">Próximos 30 dias</SelectItem>
        </SelectContent>
      </Select>

      {/* Beneficiario Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar beneficiário..."
          value={beneficiario}
          onChange={(e) => onBeneficiarioChange(e.target.value)}
          className="pl-9 w-[200px]"
        />
      </div>

      {/* Unit Select */}
      <Select value={unitId} onValueChange={onUnitIdChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as unidades</SelectItem>
          {units.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>
              {unit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Payment Account Select */}
      <Select value={paymentAccountId} onValueChange={onPaymentAccountIdChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Conta de pagamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as contas</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
              {account.institution && ` (${account.institution})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
