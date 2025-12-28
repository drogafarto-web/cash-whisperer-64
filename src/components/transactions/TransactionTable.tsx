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
import { format } from 'date-fns';
import { 
  Check, 
  X, 
  FileText,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';

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

  return (
    <TableRow>
      <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
      {isAdmin && <TableCell className="text-muted-foreground">{tx.unit?.name || '—'}</TableCell>}
      <TableCell>
        <Badge variant={tx.type === 'ENTRADA' ? 'default' : 'secondary'}>
          {tx.type}
        </Badge>
      </TableCell>
      <TableCell className={tx.type === 'ENTRADA' ? 'text-success font-medium' : 'text-destructive font-medium'}>
        {tx.type === 'ENTRADA' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
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
      <TableCell className="hidden md:table-cell">{tx.category?.name}</TableCell>
      <TableCell className="hidden lg:table-cell">{tx.account?.name}</TableCell>
      {isAdmin && <TableCell>{getStatusBadge(tx.status)}</TableCell>}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {tx.documents && tx.documents.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewDocument}
            >
              {tx.documents[0].file_type.includes('pdf') ? (
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
                <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-8 text-muted-foreground">
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
