import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  FileText, 
  ExternalLink, 
  ChevronRight,
  Calendar,
  Banknote,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TAX_DOCUMENT_LABELS, TaxDocumentType } from '@/types/payables';

export interface TaxDocument {
  id: string;
  tipo: string;
  valor: number | null;
  descricao: string | null;
  created_at: string | null;
  file_name: string;
  file_path: string;
  ano: number;
  mes: number;
  unit_id: string | null;
  payable_id: string | null;
  payable_status: string | null;
}

interface TaxDocumentsListProps {
  unitId?: string;
  limit?: number;
  showViewAll?: boolean;
  onReprocessDocument?: (doc: TaxDocument) => void;
  statusFilter?: string;
}

export function TaxDocumentsList({ 
  unitId, 
  limit = 10, 
  showViewAll = true,
  onReprocessDocument,
  statusFilter: externalStatusFilter
}: TaxDocumentsListProps) {
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>('all');
  
  // Use external filter if provided, otherwise use internal
  const statusFilter = externalStatusFilter ?? internalStatusFilter;

  useEffect(() => {
    loadDocuments();
  }, [unitId, statusFilter]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('accounting_lab_documents')
        .select('*')
        .in('tipo', ['das', 'darf', 'gps', 'inss', 'fgts'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          query = query.or('payable_status.is.null,payable_status.eq.pending,payable_status.eq.failed,payable_status.eq.skipped');
        } else {
          query = query.eq('payable_status', statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocuments((data || []) as TaxDocument[]);
    } catch (error) {
      console.error('Error loading tax documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (doc: TaxDocument) => {
    if (doc.payable_id || doc.payable_status === 'created') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Vinculado
        </Badge>
      );
    }
    if (doc.payable_status === 'failed') {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Falhou
        </Badge>
      );
    }
    if (doc.payable_status === 'skipped') {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Ignorado
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <AlertCircle className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const canReprocess = (doc: TaxDocument) => {
    return !doc.payable_id && doc.payable_status !== 'created';
  };

  const handleOpenFile = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('accounting-documents')
        .createSignedUrl(filePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error('Erro ao abrir arquivo');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentos Tributários Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentos Tributários Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p>Nenhum documento tributário enviado ainda.</p>
            <p className="text-sm">Faça upload de DARF, GPS, FGTS ou DAS acima.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentos Tributários Recentes
        </CardTitle>
        <div className="flex items-center gap-2">
          {!externalStatusFilter && (
            <Select value={internalStatusFilter} onValueChange={setInternalStatusFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="created">Vinculados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          )}
          {showViewAll && documents.length >= limit && (
            <Button variant="ghost" size="sm">
              Ver Todos <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <Badge variant="outline">
                    {TAX_DOCUMENT_LABELS[doc.tipo as TaxDocumentType] || doc.tipo}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{formatCurrency(doc.valor)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{doc.mes}/{doc.ano}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(doc)}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                    {doc.file_name}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canReprocess(doc) && onReprocessDocument && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onReprocessDocument(doc)}
                        title="Reprocessar documento"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenFile(doc.file_path)}
                      title="Abrir arquivo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
