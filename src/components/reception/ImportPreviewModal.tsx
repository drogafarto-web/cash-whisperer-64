import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Layers, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PreviewRecord {
  codigo: string;
  paciente: string;
  convenio: string;
  valorPago: number;
  paymentMethod: string;
  unitId: string;
  unitName?: string;
  data: string;
  // Campos de auditoria para duplicados
  isDuplicate?: boolean;
  originalImportedAt?: string;
  originalImportedBy?: string;
  // Campos de consolidação
  consolidatedCount?: number;
}

interface ImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recordsToImport: PreviewRecord[];
  recordsIgnored: PreviewRecord[];
  consolidatedCount: number;
  isImporting: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPaymentMethod = (method: string) => {
  const methods: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'CARTAO_CREDITO': 'Crédito',
    'CARTAO_DEBITO': 'Débito',
    'PIX': 'PIX',
    'MISTO': 'Misto',
  };
  return methods[method] || method;
};

export function ImportPreviewModal({
  open,
  onClose,
  onConfirm,
  recordsToImport,
  recordsIgnored,
  consolidatedCount,
  isImporting,
}: ImportPreviewModalProps) {
  const totalNewValue = recordsToImport.reduce((sum, r) => sum + r.valorPago, 0);
  const totalIgnoredValue = recordsIgnored.reduce((sum, r) => sum + r.valorPago, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Pré-Visualização da Importação
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="p-3 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{recordsToImport.length}</p>
                <p className="text-xs text-muted-foreground">Novos registros</p>
                <p className="text-sm font-medium text-green-600">{formatCurrency(totalNewValue)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-3 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-600">{recordsIgnored.length}</p>
                <p className="text-xs text-muted-foreground">Já importados</p>
                <p className="text-sm font-medium text-amber-600">{formatCurrency(totalIgnoredValue)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/50 bg-blue-500/10">
            <CardContent className="p-3 flex items-center gap-3">
              <Layers className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{consolidatedCount}</p>
                <p className="text-xs text-muted-foreground">Consolidados</p>
                <p className="text-sm text-muted-foreground">do arquivo</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs with tables */}
        <Tabs defaultValue="new" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              Novos
              <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                {recordsToImport.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ignored" className="gap-2">
              Ignorados
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
                {recordsIgnored.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[280px] border rounded-md">
              {recordsToImport.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <AlertTriangle className="h-8 w-8 mb-2" />
                  <p>Nenhum registro novo para importar</p>
                  <p className="text-sm">Todos os códigos já existem no sistema</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Convênio</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsToImport.map((record, idx) => (
                      <TableRow key={`new-${idx}`}>
                        <TableCell className="font-mono text-xs">
                          {record.codigo}
                          {(record.consolidatedCount ?? 0) > 1 && (
                            <Badge variant="outline" className="ml-1 text-[10px] px-1">
                              ×{record.consolidatedCount}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.paciente}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          {record.convenio}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.valorPago)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {formatPaymentMethod(record.paymentMethod)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ignored" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[280px] border rounded-md">
              {recordsIgnored.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                  <p>Nenhum registro duplicado</p>
                  <p className="text-sm">Todos os códigos são novos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Importado em</TableHead>
                      <TableHead>Por</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsIgnored.map((record, idx) => (
                      <TableRow key={`ign-${idx}`} className="text-muted-foreground">
                        <TableCell className="font-mono text-xs">
                          {record.codigo}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.paciente}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.originalImportedAt
                            ? format(new Date(record.originalImportedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate text-xs">
                          {record.originalImportedBy || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.valorPago)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isImporting || recordsToImport.length === 0}
            className="gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Importação ({recordsToImport.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
