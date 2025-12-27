import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Receipt, CheckCircle2, Loader2, Upload, Package, Truck, TestTube, Wrench, MoreHorizontal } from 'lucide-react';
import { notifySuccess, notifyError } from '@/lib/notify';
import { useCreatePayable } from '@/features/payables/hooks/usePayables';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ReceptionSupplierExpenseProps {
  onBack: () => void;
  unitId: string | null;
}

const CATEGORY_PRESETS = [
  { id: 'material', label: 'Material', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'laboratorio', label: 'Laboratório', icon: TestTube },
  { id: 'manutencao', label: 'Manutenção', icon: Wrench },
  { id: 'outros', label: 'Outros', icon: MoreHorizontal },
];

export function ReceptionSupplierExpense({ onBack, unitId }: ReceptionSupplierExpenseProps) {
  const createPayable = useCreatePayable();

  const [supplierName, setSupplierName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
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
    if (!supplierName || !category || !value || !dueDate) {
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
        const filePathGenerated = `payables/${Date.now()}.${fileExt}`;
        
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

      const parsedValue = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));

      await createPayable.mutateAsync({
        data: {
          beneficiario: supplierName,
          valor: parsedValue,
          vencimento: dueDate,
          description: description || `${category} - ${supplierName}`,
          unit_id: unitId || undefined,
          file_path: filePath,
          file_name: fileName,
          tipo: 'boleto',
        },
        filePath,
        fileName,
      });

      setSuccess(true);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      notifyError('Erro ao salvar', 'Não foi possível salvar a despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tela de sucesso
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <CheckCircle2 className="h-24 w-24 text-green-500" />
        <h1 className="text-3xl font-bold">Despesa Salva!</h1>
        <p className="text-xl text-muted-foreground">{supplierName}</p>
        <p className="text-lg">
          Valor: R$ {parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-muted-foreground">Vencimento: {format(new Date(dueDate), 'dd/MM/yyyy')}</p>
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
            <Receipt className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold">Nota de Fornecedor</h2>
            <p className="text-muted-foreground mt-2">
              Cadastre uma despesa ou boleto
            </p>
          </div>

          <div className="space-y-4">
            {/* Fornecedor */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor</Label>
              <Input
                id="supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                className="h-12 text-lg"
              />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_PRESETS.map((cat) => (
                  <Button
                    key={cat.id}
                    type="button"
                    variant={category === cat.id ? 'default' : 'outline'}
                    className="h-14 flex flex-col gap-1 text-xs"
                    onClick={() => setCategory(cat.id)}
                  >
                    <cat.icon className="h-5 w-5" />
                    <span>{cat.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="h-12 text-lg"
              />
            </div>

            {/* Vencimento */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-12 text-lg"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da despesa"
                className="h-12"
              />
            </div>

            {/* Upload de arquivo */}
            <div className="space-y-2">
              <Label>Anexar Documento (opcional)</Label>
              <label className="flex items-center justify-center gap-2 h-16 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {file ? file.name : 'Foto ou PDF do boleto/nota'}
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
              disabled={!supplierName || !category || !value || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Despesa'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
