import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvoiceMutation, usePayers } from '@/hooks/useBilling';
import { Invoice } from '@/types/billing';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceFormProps {
  initialData?: Partial<Invoice>;
  onSuccess: () => void;
  onCancel: () => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();

export default function InvoiceForm({ initialData, onSuccess, onCancel }: InvoiceFormProps) {
  const { user } = useAuth();
  const invoiceMutation = useInvoiceMutation();
  const { data: payers = [] } = usePayers();
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    document_number: initialData?.document_number || '',
    document_full_number: initialData?.document_full_number || '',
    verification_code: initialData?.verification_code || '',
    issue_date: initialData?.issue_date || format(new Date(), 'yyyy-MM-dd'),
    competence_year: initialData?.competence_year || currentYear,
    competence_month: initialData?.competence_month || (new Date().getMonth() + 1),
    service_value: initialData?.service_value || 0,
    deductions: initialData?.deductions || 0,
    iss_value: initialData?.iss_value || 0,
    net_value: initialData?.net_value || 0,
    issuer_name: initialData?.issuer_name || '',
    issuer_cnpj: initialData?.issuer_cnpj || '',
    payer_id: initialData?.payer_id || '',
    customer_name: initialData?.customer_name || '',
    customer_cnpj: initialData?.customer_cnpj || '',
    customer_city: initialData?.customer_city || '',
    description: initialData?.description || '',
    unit_id: initialData?.unit_id || '',
    status: initialData?.status || 'ABERTA',
    notes: initialData?.notes || '',
    file_name: initialData?.file_name || '',
    file_path: initialData?.file_path || '',
  });

  // Auto-calculate net value
  useEffect(() => {
    const net = formData.service_value - formData.deductions - formData.iss_value;
    if (net !== formData.net_value) {
      setFormData(prev => ({ ...prev, net_value: Math.max(0, net) }));
    }
  }, [formData.service_value, formData.deductions, formData.iss_value]);

  // Auto-fill payer data when selected
  const handlePayerChange = (payerId: string) => {
    const payer = payers.find(p => p.id === payerId);
    if (payer) {
      setFormData(prev => ({
        ...prev,
        payer_id: payerId,
        customer_name: payer.name,
        customer_cnpj: payer.cnpj || '',
        customer_city: payer.city || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, payer_id: payerId }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await invoiceMutation.mutateAsync({
      ...formData,
      id: initialData?.id,
      created_by: initialData?.id ? undefined : user?.id,
    });

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Document Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="document_number">Número da Nota *</Label>
          <Input
            id="document_number"
            value={formData.document_number}
            onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
            placeholder="196/2025"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="issue_date">Data de Emissão *</Label>
          <Input
            id="issue_date"
            type="date"
            value={formData.issue_date}
            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="verification_code">Código Verificação</Label>
          <Input
            id="verification_code"
            value={formData.verification_code}
            onChange={(e) => setFormData({ ...formData, verification_code: e.target.value })}
            placeholder="GKYAPTD2RR"
          />
        </div>
      </div>

      {/* Competence */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Mês de Competência *</Label>
          <Select
            value={formData.competence_month.toString()}
            onValueChange={(v) => setFormData({ ...formData, competence_month: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Ano de Competência *</Label>
          <Select
            value={formData.competence_year.toString()}
            onValueChange={(v) => setFormData({ ...formData, competence_year: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payer / Customer */}
      <div className="space-y-2">
        <Label>Tomador (Convênio/Prefeitura)</Label>
        <Select
          value={formData.payer_id || 'manual'}
          onValueChange={handlePayerChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione ou digite manualmente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Digitar manualmente</SelectItem>
            {payers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="customer_name">Nome do Tomador *</Label>
          <Input
            id="customer_name"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            placeholder="Prefeitura Municipal de Silveirânia"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer_cnpj">CNPJ do Tomador</Label>
          <Input
            id="customer_cnpj"
            value={formData.customer_cnpj}
            onChange={(e) => setFormData({ ...formData, customer_cnpj: e.target.value })}
            placeholder="17.744.558/0001-84"
          />
        </div>
      </div>

      {/* Values */}
      <div className="grid grid-cols-4 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="service_value">Valor Serviços *</Label>
          <Input
            id="service_value"
            type="number"
            step="0.01"
            value={formData.service_value}
            onChange={(e) => setFormData({ ...formData, service_value: Number(e.target.value) })}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="deductions">Deduções</Label>
          <Input
            id="deductions"
            type="number"
            step="0.01"
            value={formData.deductions}
            onChange={(e) => setFormData({ ...formData, deductions: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="iss_value">ISS</Label>
          <Input
            id="iss_value"
            type="number"
            step="0.01"
            value={formData.iss_value}
            onChange={(e) => setFormData({ ...formData, iss_value: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="net_value">Valor Líquido</Label>
          <Input
            id="net_value"
            type="number"
            step="0.01"
            value={formData.net_value}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>

      {/* Unit */}
      <div className="grid gap-2">
        <Label>Unidade</Label>
        <Select
          value={formData.unit_id || 'none'}
          onValueChange={(v) => setFormData({ ...formData, unit_id: v === 'none' ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem unidade específica</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="description">Discriminação dos Serviços</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrição dos serviços prestados..."
          rows={3}
        />
      </div>

      {/* Status */}
      {initialData?.id && (
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ABERTA">Aberta</SelectItem>
              <SelectItem value="RECEBIDA">Recebida</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invoiceMutation.isPending}>
          {invoiceMutation.isPending ? 'Salvando...' : 'Salvar Nota Fiscal'}
        </Button>
      </div>
    </form>
  );
}
