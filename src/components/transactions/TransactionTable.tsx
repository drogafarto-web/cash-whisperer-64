import React, { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Transaction, Document } from '@/types/database';
import { format, parseISO, isValid } from 'date-fns';
import { 
  Check, 
  X, 
  FileText,
  Image as ImageIcon,
  RefreshCw,
  FlaskConical,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface TransactionTableProps {
  transactions: Transaction[];
  isAdmin: boolean;
  onApprove: (tx: Transaction) => void;
  onReject: (tx: Transaction, reason: string) => void;
  onViewDocument: (doc: Document) => void;
}

interface TransactionRowProps {
  tx: Transaction;
  isAdmin: boolean;
  onApprove: (tx: Transaction) => void;
  onReject: (tx: Transaction, reason: string) => void;
  onViewDocument: (doc: Document) => void;
}

// Safe date formatter - never throws
const safeFormatDate = (dateValue: unknown): string => {
  if (!dateValue) return '—';
  
  try {
    let date: Date;
    
    if (typeof dateValue === 'string') {
      // Try parseISO first (handles ISO strings)
      date = parseISO(dateValue);
      // If parseISO fails, try new Date()
      if (!isValid(date)) {
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '—';
    }
    
    if (!isValid(date)) {
      return '—';
    }
    
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '—';
  }
};

// Safe file type checker - never throws
const isFilePdf = (fileType: unknown): boolean => {
  if (!fileType || typeof fileType !== 'string') return false;
  return fileType.toLowerCase().includes('pdf');
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'APROVADO':
      return <Badge className="bg-success text-success-foreground">Aprovado</Badge>;
    case 'REJEITADO':
      return <Badge variant="destructive">Rejeitado</Badge>;
    default:
      return <Badge variant="secondary" className="bg-warning/20 text-warning">Pendente</Badge>;
  }
};

// Memoized row component para evitar re-renders desnecessários
const TransactionRow = memo(function TransactionRow({
  tx,
  isAdmin,
  onApprove,
  onReject,
  onViewDocument,
}: TransactionRowProps) {
  const handleApprove = useCallback(() => onApprove(tx), [onApprove, tx]);
  const handleReject = useCallback(() => onReject(tx, 'Rejeitado pelo administrador'), [onReject, tx]);
  const handleViewDocument = useCallback(() => {
    if (tx.documents && tx.documents.length > 0) {
      onViewDocument(tx.documents[0]);
    }
  }, [onViewDocument, tx.documents]);

  const firstDoc = tx.documents?.[0];

  return (
    <TableRow>
      <TableCell>{safeFormatDate(tx.date)}</TableCell>
      {/* LIS Code Column */}
      <TableCell className="hidden sm:table-cell">
        {tx.lis_protocol_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="font-mono text-xs cursor-help">
                <FlaskConical className="h-3 w-3 mr-1" />
                {tx.lis_protocol_id}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Código LIS vinculado</p>
              {tx.lis_source && <p className="text-xs text-muted-foreground">Origem: {tx.lis_source}</p>}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {isAdmin && <TableCell className="text-muted-foreground">{tx.unit?.name || '—'}</TableCell>}
      <TableCell>
        <Badge variant={tx.type === 'ENTRADA' ? 'default' : 'secondary'}>
          {tx.type}
        </Badge>
      </TableCell>
      <TableCell className={tx.type === 'ENTRADA' ? 'text-success font-medium' : 'text-destructive font-medium'}>
        {tx.type === 'ENTRADA' ? '+' : '-'} R$ {Number(tx.amount || 0).toFixed(2)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {tx.partner ? (
          <div className="flex items-center gap-1">
            <span>{tx.partner.name}</span>
            {tx.partner.is_recurring && (
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        ) : '—'}
      </TableCell>
      <TableCell className="hidden md:table-cell">{tx.category?.name || '—'}</TableCell>
      <TableCell className="hidden lg:table-cell">{tx.account?.name || '—'}</TableCell>
      {isAdmin && <TableCell>{getStatusBadge(tx.status || 'PENDENTE')}</TableCell>}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {firstDoc && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewDocument}
            >
              {isFilePdf(firstDoc.file_type) ? (
                <FileText className="w-4 h-4" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </Button>
          )}
          {isAdmin && tx.status === 'PENDENTE' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-success hover:text-success"
                onClick={handleApprove}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={handleReject}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

export const TransactionTable = memo(function TransactionTable({
  transactions,
  isAdmin,
  onApprove,
  onReject,
  onViewDocument,
}: TransactionTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="hidden sm:table-cell">Código LIS</TableHead>
              {isAdmin && <TableHead>Unidade</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="hidden md:table-cell">Parceiro</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Conta</TableHead>
              {isAdmin && <TableHead>Status</TableHead>}
              <TableHead className="text-right">{isAdmin ? 'Ações' : 'Documento'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 10 : 8} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              transactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isAdmin={isAdmin}
                  onApprove={onApprove}
                  onReject={onReject}
                  onViewDocument={onViewDocument}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
