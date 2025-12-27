import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  FileText, 
  Receipt, 
  FileUp, 
  Upload, 
  Trash2, 
  Send,
  Loader2,
  File,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  useLabSubmission, 
  useLabDocuments, 
  useLabSubmissionMutation,
  useUploadLabDocument,
  useDeleteLabDocument,
  useSubmitToAccounting,
} from '@/hooks/useAccountingCompetence';

interface AccountingSendDocumentsProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  onBack: () => void;
}

type DocumentType = 'nf' | 'despesa' | 'extrato_bancario';

export function AccountingSendDocuments({ unitId, unitName, competence, onBack }: AccountingSendDocumentsProps) {
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const [activeTab, setActiveTab] = useState<DocumentType>('nf');
  const [observacoes, setObservacoes] = useState('');
  
  const { data: submission, isLoading: loadingSubmission } = useLabSubmission(unitId, ano, mes);
  const { data: documents = [], isLoading: loadingDocs } = useLabDocuments(submission?.id || null);
  
  const submissionMutation = useLabSubmissionMutation();
  const uploadMutation = useUploadLabDocument();
  const deleteMutation = useDeleteLabDocument();
  const submitMutation = useSubmitToAccounting();
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });
  
  const filteredDocs = documents.filter(d => d.tipo === activeTab);
  
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !unitId) return;
    
    const file = e.target.files[0];
    
    // Ensure we have a submission first
    let submissionId = submission?.id;
    
    if (!submissionId) {
      try {
        const newSubmission = await submissionMutation.mutateAsync({
          unit_id: unitId,
          ano,
          mes,
          status: 'rascunho',
        });
        submissionId = newSubmission.id;
      } catch (error) {
        toast.error('Erro ao criar envio');
        return;
      }
    }
    
    await uploadMutation.mutateAsync({
      file,
      submission_id: submissionId,
      unit_id: unitId,
      ano,
      mes,
      tipo: activeTab,
    });
    
    // Reset input
    e.target.value = '';
  }, [unitId, ano, mes, activeTab, submission?.id, submissionMutation, uploadMutation]);

  const handleDelete = async (doc: typeof documents[0]) => {
    if (!doc.id || !submission?.id) return;
    
    await deleteMutation.mutateAsync({
      id: doc.id,
      file_path: doc.file_path,
      submission_id: submission.id,
    });
  };

  const handleSubmit = async () => {
    if (!submission?.id || !unitId) {
      toast.error('Nenhum documento para enviar');
      return;
    }
    
    if (documents.length === 0) {
      toast.error('Adicione pelo menos um documento antes de enviar');
      return;
    }
    
    // Update observações if changed
    if (observacoes !== submission.observacoes) {
      await submissionMutation.mutateAsync({
        unit_id: unitId,
        ano,
        mes,
        observacoes,
      });
    }
    
    await submitMutation.mutateAsync({
      submission_id: submission.id,
      unit_id: unitId,
      ano,
      mes,
    });
  };

  const isReadOnly = submission?.status === 'enviado' || submission?.status === 'recebido';

  if (loadingSubmission) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {submission && (
          <Badge variant={submission.status === 'enviado' ? 'default' : 'outline'}>
            {submission.status === 'enviado' ? 'Enviado' : submission.status === 'recebido' ? 'Recebido' : 'Rascunho'}
          </Badge>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Enviar para Contabilidade</p>
        <p className="text-xl font-semibold capitalize">{competenceLabel} — {unitName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Fluxo contínuo Jan/2026+ • Documentos para apuração fiscal
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeTab === 'nf' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('nf')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Notas Fiscais ({documents.filter(d => d.tipo === 'nf').length})
        </Button>
        <Button 
          variant={activeTab === 'despesa' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('despesa')}
          className="gap-2"
        >
          <Receipt className="h-4 w-4" />
          Despesas ({documents.filter(d => d.tipo === 'despesa').length})
        </Button>
        <Button 
          variant={activeTab === 'extrato_bancario' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('extrato_bancario')}
          className="gap-2"
        >
          <FileUp className="h-4 w-4" />
          Extrato ({documents.filter(d => d.tipo === 'extrato_bancario').length})
        </Button>
      </div>

      {/* Upload area */}
      {!isReadOnly && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload}
                accept=".pdf,.xml,.jpg,.jpeg,.png"
                disabled={uploadMutation.isPending}
              />
              <div className="p-4 rounded-full bg-muted mb-3">
                {uploadMutation.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-medium">
                {activeTab === 'nf' && 'Clique para adicionar Nota Fiscal'}
                {activeTab === 'despesa' && 'Clique para adicionar Comprovante de Despesa'}
                {activeTab === 'extrato_bancario' && 'Clique para adicionar Extrato Bancário'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, XML, JPG ou PNG
              </p>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Documents list */}
      {loadingDocs ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">
                    <File className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—'}
                      {doc.valor ? ` • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.valor)}` : ''}
                    </p>
                  </div>
                </div>
                {!isReadOnly && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum documento adicionado</p>
        </div>
      )}

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea 
            placeholder="Observações para a contabilidade (opcional)"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={isReadOnly}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit button */}
      {!isReadOnly && (
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            onClick={handleSubmit}
            disabled={submitMutation.isPending || documents.length === 0}
            className="gap-2"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Confirmar Envio para Contabilidade
          </Button>
        </div>
      )}

      {isReadOnly && submission?.enviado_em && (
        <div className="text-center text-sm text-muted-foreground">
          Enviado em {format(new Date(submission.enviado_em), "dd/MM/yyyy 'às' HH:mm")}
        </div>
      )}
    </div>
  );
}
