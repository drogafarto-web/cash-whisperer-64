/**
 * Tabela de seleção de códigos LIS para fechamento de caixa
 * 
 * Permite que a recepcionista selecione quais códigos LIS
 * foram efetivamente pagos neste fechamento.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Banknote,
  CreditCard,
  Smartphone,
  XCircle,
  FileText,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { LisClosureItemForSelection } from '@/hooks/useCashClosingSelection';

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  DINHEIRO: <Banknote className="h-4 w-4 text-green-600" />,
  PIX: <Smartphone className="h-4 w-4 text-purple-600" />,
  CARTAO: <CreditCard className="h-4 w-4 text-blue-600" />,
  BOLETO: <FileText className="h-4 w-4 text-orange-600" />,
  NAO_PAGO: <XCircle className="h-4 w-4 text-red-600" />,
};

const PAYMENT_STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDENTE: { label: 'Pendente', variant: 'outline' },
  PAGO_NESTE_FECHAMENTO: { label: 'Neste Fech.', variant: 'default' },
  A_RECEBER: { label: 'A Receber', variant: 'secondary' },
  PAGO_POSTERIOR: { label: 'Pago Depois', variant: 'default' },
};

interface CashClosingSelectionTableProps {
  items: LisClosureItemForSelection[];
  selectedIds: Set<string>;
  onToggleSelection: (itemId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  canSelectItem: (itemId: string) => boolean;
  isItemLocked: (itemId: string) => boolean;
  disabled?: boolean;
}

export function CashClosingSelectionTable({
  items,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  canSelectItem,
  isItemLocked,
  disabled = false,
}: CashClosingSelectionTableProps) {
  // Resumo por status de pagamento
  const summary = useMemo(() => {
    const pendentes = items.filter(i => i.payment_status === 'PENDENTE');
    const aReceber = items.filter(i => i.payment_status === 'A_RECEBER');
    const vinculados = items.filter(i => i.payment_status === 'PAGO_NESTE_FECHAMENTO');
    
    return {
      total: items.length,
      pendentes: pendentes.length,
      aReceber: aReceber.length,
      vinculados: vinculados.length,
      selecionados: selectedIds.size,
      cashSelecionado: items
        .filter(i => selectedIds.has(i.id))
        .reduce((sum, i) => sum + (i.cash_component || 0), 0),
    };
  }, [items, selectedIds]);

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            disabled={disabled}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Selecionar Todos Elegíveis
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselectAll}
            disabled={disabled}
          >
            Limpar Seleção
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {summary.selecionados} de {summary.pendentes} pendentes selecionados
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="bg-muted/50 rounded p-2 text-center">
          <span className="text-muted-foreground">Total</span>
          <p className="font-bold">{summary.total}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center">
          <span className="text-yellow-700">Pendentes</span>
          <p className="font-bold text-yellow-800">{summary.pendentes}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
          <span className="text-blue-700">A Receber</span>
          <p className="font-bold text-blue-800">{summary.aReceber}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
          <span className="text-green-700">Selecionados</span>
          <p className="font-bold text-green-800">
            R$ {summary.cashSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.size > 0 && selectedIds.size === summary.pendentes}
                  onCheckedChange={(checked) => checked ? onSelectAll() : onDeselectAll()}
                  disabled={disabled}
                />
              </TableHead>
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead className="w-[120px]">Convênio</TableHead>
              <TableHead className="w-[60px]">Pag.</TableHead>
              <TableHead className="w-[100px] text-right">Caixa</TableHead>
              <TableHead className="w-[100px] text-right">A Receber</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const isSelected = selectedIds.has(item.id);
              const canSelect = canSelectItem(item.id);
              const isLocked = isItemLocked(item.id);
              const isReceivable = item.payment_status === 'A_RECEBER';

              return (
                <TableRow
                  key={item.id}
                  className={`
                    ${isSelected ? 'bg-green-50' : ''}
                    ${isReceivable ? 'bg-blue-50/50' : ''}
                    ${isLocked ? 'bg-gray-100' : ''}
                  `}
                >
                  <TableCell>
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(item.id)}
                        disabled={disabled || !canSelect}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(item.date), 'dd/MM')}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.lis_code}</TableCell>
                  <TableCell className="text-sm truncate max-w-[150px]">
                    {item.patient_name}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[100px]">
                    {item.convenio || '-'}
                  </TableCell>
                  <TableCell>
                    {PAYMENT_METHOD_ICONS[item.payment_method] || item.payment_method}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-700">
                    {item.cash_component > 0
                      ? `R$ ${item.cash_component.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {item.receivable_component > 0
                      ? `R$ ${item.receivable_component.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_BADGES[item.payment_status]?.variant || 'outline'}>
                      {PAYMENT_STATUS_BADGES[item.payment_status]?.label || item.payment_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
