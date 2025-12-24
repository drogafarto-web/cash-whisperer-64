import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';

interface EnvelopeItemsTableProps {
  items: LisItemForEnvelope[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  allSelected: boolean;
}

export function EnvelopeItemsTable({
  items,
  selectedIds,
  onToggleItem,
  onSelectAll,
  onClearSelection,
  allSelected,
}: EnvelopeItemsTableProps) {
  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      onSelectAll();
    } else {
      onClearSelection();
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAllChange}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor Dinheiro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum item disponível para envelope
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow 
                key={item.id}
                className={selectedIds.has(item.id) ? 'bg-primary/5' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => onToggleItem(item.id)}
                    aria-label={`Selecionar ${item.lis_code}`}
                  />
                </TableCell>
                <TableCell className="font-mono font-medium">
                  {item.lis_code}
                </TableCell>
                <TableCell>{formatDate(item.date)}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {item.patient_name || '-'}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.convenio === 'PARTICULAR' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {item.convenio === 'PARTICULAR' ? 'Particular' : item.convenio || 'Convênio'}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.cash_component)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
