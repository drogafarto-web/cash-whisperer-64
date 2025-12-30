import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TaxDocumentUpload } from '@/components/payables/TaxDocumentUpload';
import { TaxDocumentConfirmModal, ConfirmData } from '@/components/payables/TaxDocumentConfirmModal';
import { TaxDocumentsList, TaxDocument } from '@/components/payables/TaxDocumentsList';
import { TaxDocumentsConsistencyCard } from '@/components/accounting/TaxDocumentsConsistencyCard';
import { ReprocessDocumentModal } from '@/components/payables/ReprocessDocumentModal';
import { TaxDocumentOcrResult, TAX_DOCUMENT_LABELS } from '@/types/payables';
import { createPayable } from '@/features/payables/api/payables.api';
import { UnitSelector } from '@/components/UnitSelector';
import { AIErrorExplanation } from '@/components/ui/AIErrorExplanation';
import { handleError } from '@/lib/errorHandler';

export default function TaxDocumentsPage() {
  const { profile } = useAuth();
  const [unitId, setUnitId] = useState<string>(profile?.unit_id || '');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState<TaxDocumentOcrResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  
  // Reprocess modal state
  const [reprocessModalOpen, setReprocessModalOpen] = useState(false);
  const [documentToReprocess, setDocumentToReprocess] = useState<TaxDocument | null>(null);
  
  // Refresh trigger for list
  const [refreshKey, setRefreshKey] = useState(0);

  // AI Error state
  const [aiError, setAiError] = useState<{ message: string; context?: Record<string, any> } | null>(null);

  const handleOcrComplete = (result: TaxDocumentOcrResult, file: File, filePath: string) => {
    setOcrResult(result);
    setUploadedFile(file);
    setUploadedFilePath(filePath);
    setIsModalOpen(true);
  };

  const handleReprocessDocument = (doc: TaxDocument) => {
    setDocumentToReprocess(doc);
    setReprocessModalOpen(true);
  };

  const handleReprocessSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleConfirm = async (shouldCreatePayable: boolean, data: ConfirmData) => {
    try {
      // Get current date info
      const now = new Date();
      const ano = data.competencia?.ano || now.getFullYear();
      const mes = data.competencia?.mes || now.getMonth() + 1;

      // Get file URL
      let fileUrl = '';
      if (uploadedFilePath) {
        const { data: urlData } = await supabase.storage
          .from('payables')
          .getPublicUrl(uploadedFilePath);
        fileUrl = urlData?.publicUrl || '';
      }

      // Save document to accounting_lab_documents with status tracking
      const { data: insertedDoc, error: docError } = await supabase
        .from('accounting_lab_documents')
        .insert({
          tipo: data.tipo_documento,
          ano,
          mes,
          valor: data.valor,
          descricao: `${TAX_DOCUMENT_LABELS[data.tipo_documento]} - Venc: ${data.vencimento}`,
          file_name: uploadedFile?.name || 'documento.pdf',
          file_path: uploadedFilePath || '',
          unit_id: data.unitId,
          created_by: profile?.id,
          payable_status: shouldCreatePayable ? 'pending' : 'skipped',
        })
        .select('id')
        .single();

      if (docError) {
        throw new Error(`Erro ao salvar documento: ${docError.message}`);
      }

      // Create payable if requested
      if (shouldCreatePayable) {
        try {
          const payable = await createPayable(
            {
              beneficiario: data.beneficiario || TAX_DOCUMENT_LABELS[data.tipo_documento],
              beneficiario_cnpj: data.cnpj || undefined,
              valor: data.valor,
              vencimento: data.vencimento,
              linha_digitavel: data.linha_digitavel || undefined,
              codigo_barras: data.codigo_barras || undefined,
              description: `${TAX_DOCUMENT_LABELS[data.tipo_documento]} - Comp: ${mes}/${ano}`,
              tipo: 'boleto',
              unit_id: data.unitId || undefined,
              category_id: data.categoryId || undefined,
            },
            uploadedFilePath || undefined,
            uploadedFile?.name
          );

          // Update document with payable reference
          if (payable && insertedDoc?.id) {
            await supabase
              .from('accounting_lab_documents')
              .update({
                payable_id: payable.id,
                payable_status: 'created'
              })
              .eq('id', insertedDoc.id);
          }

          // If PIX key exists, update the payable with it
          if (data.pix_key) {
            console.log('PIX key available:', data.pix_key, data.pix_tipo);
          }

          toast.success('Documento salvo e Conta a Pagar criada!');
        } catch (payableError) {
          // Update document status to failed
          if (insertedDoc?.id) {
            await supabase
              .from('accounting_lab_documents')
              .update({ payable_status: 'failed' })
              .eq('id', insertedDoc.id);
          }
          console.error('Error creating payable:', payableError);
          toast.warning('Documento salvo, mas falha ao criar Conta a Pagar. Use o botão Reprocessar.');
        }
      } else {
        toast.success('Documento salvo com sucesso!');
      }

      // Reset state and refresh list
      setIsModalOpen(false);
      setOcrResult(null);
      setUploadedFile(null);
      setUploadedFilePath(null);
      setRefreshKey(prev => prev + 1);

    } catch (error) {
      console.error('Error confirming document:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao salvar';
      setAiError({
        message: errorMsg,
        context: { screen: 'Documentos Tributários', action: 'confirmar_documento', tipo: ocrResult?.tipo_documento }
      });
      handleError(error, { screen: 'Documentos Tributários', action: 'confirmar_documento' });
      throw error;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Documentos Tributários
            </h1>
            <p className="text-muted-foreground mt-1">
              Envie DARF, GPS, FGTS, DAS e crie pagamentos automaticamente
            </p>
          </div>
          <div className="w-full sm:w-64">
            <UnitSelector value={unitId} onChange={setUnitId} />
          </div>
        </div>

        {/* Consistency Report Card */}
        <TaxDocumentsConsistencyCard 
          unitId={unitId}
          onReprocessDocument={handleReprocessDocument}
        />

        {/* Upload Zone */}
        <TaxDocumentUpload 
          unitId={unitId}
          onOcrComplete={handleOcrComplete}
        />

        {/* Features info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">OCR Inteligente</h3>
                  <p className="text-sm text-muted-foreground">
                    Extrai automaticamente valor, vencimento e código de barras
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Criação Automática</h3>
                  <p className="text-sm text-muted-foreground">
                    Cria Conta a Pagar com um clique a partir do OCR
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Copia e Cola</h3>
                  <p className="text-sm text-muted-foreground">
                    Copie linha digitável, código de barras ou PIX facilmente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <TaxDocumentsList 
          key={refreshKey}
          unitId={unitId} 
          limit={10}
          onReprocessDocument={handleReprocessDocument}
        />

        {/* Confirmation Modal */}
        <TaxDocumentConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ocrResult={ocrResult}
          file={uploadedFile}
          filePath={uploadedFilePath}
          unitId={unitId}
          onConfirm={handleConfirm}
        />

        {/* Reprocess Modal */}
        <ReprocessDocumentModal
          open={reprocessModalOpen}
          onOpenChange={setReprocessModalOpen}
          document={documentToReprocess}
          onSuccess={handleReprocessSuccess}
        />

        {/* AI Error Explanation */}
        {aiError && (
          <div className="fixed bottom-20 right-4 max-w-md z-40">
            <AIErrorExplanation
              error={aiError.message}
              context={aiError.context}
              useAI={true}
              onDismiss={() => setAiError(null)}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
