import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  Copy, 
  Check, 
  ExternalLink, 
  ChevronRight,
  Calendar,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TAX_DOCUMENT_LABELS, TaxDocumentType } from '@/types/payables';
import { Json } from '@/integrations/supabase/types';

interface TaxDocument {
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
}

interface TaxDocumentsListProps {
  unitId?: string;
  limit?: number;
  showViewAll?: boolean;
}

export function TaxDocumentsList({ unitId, limit = 10, showViewAll = true }: TaxDocumentsListProps) {
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [unitId]);

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

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading tax documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
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
        {showViewAll && documents.length >= limit && (
          <Button variant="ghost" size="sm">
            Ver Todos <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Competência</TableHead>
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
                  <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                    {doc.file_name}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
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
