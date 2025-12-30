import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TAX_DOCUMENT_LABELS, TaxDocumentType } from '@/types/payables';

interface ConsistencyStats {
  total: number;
  created: number;
  pending: number;
  failed: number;
  skipped: number;
}

interface UnlinkedDocument {
  id: string;
  tipo: string;
  valor: number | null;
  mes: number;
  ano: number;
  file_name: string;
  payable_status: string | null;
}

interface TaxDocumentsConsistencyCardProps {
  unitId?: string;
  onReprocessDocument?: (doc: UnlinkedDocument) => void;
}

export function TaxDocumentsConsistencyCard({ 
  unitId,
  onReprocessDocument 
}: TaxDocumentsConsistencyCardProps) {
  const [stats, setStats] = useState<ConsistencyStats | null>(null);
  const [unlinkedDocs, setUnlinkedDocs] = useState<UnlinkedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadConsistencyData();
  }, [unitId]);

  const loadConsistencyData = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('accounting_lab_documents')
        .select('id, tipo, valor, mes, ano, file_name, payable_id, payable_status')
        .in('tipo', ['das', 'darf', 'gps', 'inss', 'fgts', 'iss']);

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const documents = data || [];
      
      // Calculate stats
      const newStats: ConsistencyStats = {
        total: documents.length,
        created: documents.filter(d => d.payable_status === 'created' || d.payable_id).length,
        pending: documents.filter(d => d.payable_status === 'pending' || (!d.payable_status && !d.payable_id)).length,
        failed: documents.filter(d => d.payable_status === 'failed').length,
        skipped: documents.filter(d => d.payable_status === 'skipped').length,
      };

      setStats(newStats);

      // Get unlinked documents (not created)
      const unlinked = documents.filter(
        d => d.payable_status !== 'created' && !d.payable_id
      );
      setUnlinkedDocs(unlinked);
    } catch (error) {
      console.error('Error loading consistency data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Criado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'skipped':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Ignorado</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Consistência de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Consistência de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>Nenhum documento tributário encontrado.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const unlinkedCount = stats.pending + stats.failed + stats.skipped;
  const successRate = stats.total > 0 ? Math.round((stats.created / stats.total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Consistência de Documentos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadConsistencyData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.created}</div>
            <div className="text-xs text-green-600/80">Com Payable</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.pending + stats.skipped}</div>
            <div className="text-xs text-amber-600/80">Pendentes</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-red-600/80">Falhas</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxa de vinculação</span>
            <span className="font-medium">{successRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Unlinked Documents List */}
        {unlinkedCount > 0 && (
          <div className="border rounded-lg">
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {unlinkedCount} documento(s) sem conta a pagar
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <ScrollArea className="max-h-[200px] border-t">
                <div className="p-2 space-y-2">
                  {unlinkedDocs.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {TAX_DOCUMENT_LABELS[doc.tipo as TaxDocumentType] || doc.tipo}
                        </Badge>
                        <span className="font-mono">{formatCurrency(doc.valor)}</span>
                        <span className="text-muted-foreground">{doc.mes}/{doc.ano}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.payable_status)}
                        {onReprocessDocument && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onReprocessDocument(doc as any)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
