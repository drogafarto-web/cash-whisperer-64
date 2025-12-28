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

export function TransactionTable({
  transactions,
  isAdmin,
  onApprove,
  onReject,
  onViewDocument,
}: TransactionTableProps) {
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
                <TableRow key={tx.id}>
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
                          onClick={() => onViewDocument(tx.documents![0])}
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
                            onClick={() => onApprove(tx)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onReject(tx, 'Rejeitado pelo administrador')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
