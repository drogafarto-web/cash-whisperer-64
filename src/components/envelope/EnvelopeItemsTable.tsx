import React, { memo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';
import { Banknote, CreditCard, QrCode, CircleDollarSign } from 'lucide-react';
import { formatCurrencyNullable } from '@/lib/utils';

interface EnvelopeItemsTableProps {
  items: LisItemForEnvelope[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  allSelected: boolean;
}

interface EnvelopeRowProps {
  item: LisItemForEnvelope;
  isSelected: boolean;
  isSelectable: boolean;
  onToggle: (itemId: string) => void;
}

// Apenas DINHEIRO pode ser selecionado para envelope físico
const isItemSelectable = (item: LisItemForEnvelope) => 
  item.payment_method === 'DINHEIRO';

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case 'DINHEIRO':
      return (
        <div className="flex items-center justify-center" title="Dinheiro">
          <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
      );
    case 'PIX':
      return (
        <div className="flex items-center justify-center" title="PIX">
          <QrCode className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        </div>
      );
    case 'CARTAO':
      return (
        <div className="flex items-center justify-center" title="Cartão">
          <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center" title={method}>
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
};

const getStatusBadge = (item: LisItemForEnvelope) => {
  const status = item.status || '';
  const paymentStatus = item.payment_status || '';

  if (status === 'DUPLICATA' || status.includes('DUPLIC')) {
    return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">Duplicata</Badge>;
  }

  if (paymentStatus === 'NAO_PAGO') {
    return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">Não Pago</Badge>;
  }

  if (paymentStatus === 'FECHADO_EM_ENVELOPE') {
    return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">Envelope</Badge>;
  }

  if (paymentStatus === 'PENDENTE' || status === 'PENDENTE') {
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">Pendente</Badge>;
  }

  if (status === 'RESOLVIDO') {
    return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">Resolvido</Badge>;
  }

  return null;
};

const getConvenioBadge = (convenio: string | null) => {
  if (!convenio) return '-';
  
  if (convenio === 'PARTICULAR') {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
        Particular
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
      {convenio}
    </Badge>
  );
};

// Memoized row component
const EnvelopeRow = memo(function EnvelopeRow({
  item,
  isSelected,
  isSelectable,
  onToggle,
}: EnvelopeRowProps) {
  const handleToggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);

  return (
    <TableRow 
      className={
        isSelected 
          ? 'bg-primary/5' 
          : !isSelectable 
            ? 'opacity-50' 
            : ''
      }
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggle}
          disabled={!isSelectable}
          aria-label={`Selecionar ${item.lis_code}`}
        />
      </TableCell>
      <TableCell className="text-sm">{formatDate(item.date)}</TableCell>
      <TableCell className="font-mono font-medium">
        {item.lis_code}
      </TableCell>
      <TableCell className="text-sm">
        {item.unit_name || '-'}
      </TableCell>
      <TableCell className="max-w-[180px] truncate text-sm">
        {item.patient_name || '-'}
      </TableCell>
      <TableCell>
        {getConvenioBadge(item.convenio)}
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrencyNullable(item.cash_component)}
      </TableCell>
      <TableCell className="text-center">
        {getPaymentMethodIcon(item.payment_method)}
      </TableCell>
      <TableCell>
        {getStatusBadge(item)}
      </TableCell>
    </TableRow>
  );
});

export const EnvelopeItemsTable = memo(function EnvelopeItemsTable({
  items,
  selectedIds,
  onToggleItem,
  onSelectAll,
  onClearSelection,
  allSelected,
}: EnvelopeItemsTableProps) {
  const handleSelectAllChange = useCallback((checked: boolean) => {
    if (checked) {
      onSelectAll();
    } else {
      onClearSelection();
    }
  }, [onSelectAll, onClearSelection]);

  // Contar quantos são selecionáveis
  const selectableCount = items.filter(isItemSelectable).length;
  const allSelectableSelected = selectableCount > 0 && 
    items.filter(isItemSelectable).every(item => selectedIds.has(item.id));

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelectableSelected}
                onCheckedChange={handleSelectAllChange}
                disabled={selectableCount === 0}
                aria-label="Selecionar todos em dinheiro"
              />
            </TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Convênio</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center w-[60px]">Pag.</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Nenhum item disponível para envelope
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <EnvelopeRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                isSelectable={isItemSelectable(item)}
                onToggle={onToggleItem}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
});
