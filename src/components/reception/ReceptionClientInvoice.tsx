import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, Receipt, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { notifySuccess, notifyError } from '@/lib/notify';
import { useInvoiceMutation } from '@/features/billing/hooks/useInvoiceMutation';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ReceptionClientInvoiceProps {
  onBack: () => void;
  unitId: string | null;
}

export function ReceptionClientInvoice({ onBack, unitId }: ReceptionClientInvoiceProps) {
  const invoiceMutation = useInvoiceMutation();

  const [documentType, setDocumentType] = useState<'nfe' | 'recibo' | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [serviceValue, setServiceValue] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!documentType || !customerName || !serviceValue || !documentNumber) {
      notifyError('Campos obrigatórios', 'Preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);

    try {
      let filePath: string | undefined;
      let fileName: string | undefined;

      // Upload do arquivo se houver
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePathGenerated = `invoices/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePathGenerated, file);

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
        } else {
          filePath = filePathGenerated;
          fileName = file.name;
        }
      }

      const now = new Date();
      const value = parseFloat(serviceValue.replace(/[^\d,.-]/g, '').replace(',', '.'));

      await invoiceMutation.mutateAsync({
        document_number: documentNumber,
        customer_name: customerName,
        service_value: value,
        net_value: value,
        issue_date: format(now, 'yyyy-MM-dd'),
        competence_year: now.getFullYear(),
        competence_month: now.getMonth() + 1,
        status: 'ABERTA' as const,
        unit_id: unitId,
        file_path: filePath,
        file_name: fileName,
        notes: documentType === 'recibo' ? 'Recibo' : undefined,
      });

      setSuccess(true);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      notifyError('Erro ao salvar', 'Não foi possível salvar a nota.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tela de sucesso
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <CheckCircle2 className="h-24 w-24 text-green-500" />
        <h1 className="text-3xl font-bold">Nota Salva!</h1>
        <p className="text-xl text-muted-foreground">
          {documentType === 'nfe' ? 'NF-e' : 'Recibo'} de {customerName}
        </p>
        <p className="text-lg">
          Valor: R$ {parseFloat(serviceValue.replace(/[^\d,.-]/g, '').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <Button size="lg" className="h-14 text-lg px-8" onClick={onBack}>
          Voltar ao Painel Recepção
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Painel
      </Button>

      <Card className="max-w-xl mx-auto">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <FileText className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold">Nota para Cliente</h2>
            <p className="text-muted-foreground mt-2">
              Cadastre uma NF-e ou recibo para cliente
            </p>
          </div>

          <div className="space-y-4">
            {/* Tipo de documento */}
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={documentType === 'nfe' ? 'default' : 'outline'}
                  className="h-16 flex flex-col gap-1"
                  onClick={() => setDocumentType('nfe')}
                >
                  <FileText className="h-6 w-6" />
                  <span>NF-e</span>
                </Button>
                <Button
                  type="button"
                  variant={documentType === 'recibo' ? 'default' : 'outline'}
                  className="h-16 flex flex-col gap-1"
                  onClick={() => setDocumentType('recibo')}
                >
                  <Receipt className="h-6 w-6" />
                  <span>Recibo</span>
                </Button>
              </div>
            </div>

            {/* Número do documento */}
            <div className="space-y-2">
              <Label htmlFor="docNumber">Número do Documento</Label>
              <Input
                id="docNumber"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ex: 12345"
                className="h-12 text-lg"
              />
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Input
                id="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente ou empresa"
                className="h-12 text-lg"
              />
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                placeholder="0,00"
                className="h-12 text-lg"
              />
            </div>

            {/* Upload de arquivo */}
            <div className="space-y-2">
              <Label>Anexar Documento (opcional)</Label>
              <label className="flex items-center justify-center gap-2 h-16 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {file ? file.name : 'Foto ou PDF da nota'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <Button
              size="lg"
              className="w-full h-14 text-lg"
              onClick={handleSubmit}
              disabled={!documentType || !customerName || !serviceValue || !documentNumber || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Nota'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
