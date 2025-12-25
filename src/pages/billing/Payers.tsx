import { useState } from 'react';
import { Plus, Edit, Building2, Handshake, Store } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { usePayers, usePayerMutation } from '@/features/billing';
import { Payer, PayerType } from '@/types/billing';
import { toast } from 'sonner';

const PAYER_TYPES: { value: PayerType; label: string; icon: React.ReactNode }[] = [
  { value: 'prefeitura', label: 'Prefeitura', icon: <Building2 className="h-4 w-4" /> },
  { value: 'convenio', label: 'Convênio', icon: <Handshake className="h-4 w-4" /> },
  { value: 'empresa', label: 'Empresa', icon: <Store className="h-4 w-4" /> },
];

export default function Payers() {
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null);
  const [formData, setFormData] = useState<Partial<Payer>>({
    name: '',
    cnpj: '',
    type: 'convenio',
    email: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    notes: '',
    active: true,
  });

  const { data: payers = [], isLoading } = usePayers(false);
  const payerMutation = usePayerMutation();
  

  const getTypeIcon = (type: PayerType) => {
    const found = PAYER_TYPES.find((t) => t.value === type);
    return found?.icon;
  };

  const getTypeLabel = (type: PayerType) => {
    const found = PAYER_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  const handleEdit = (payer: Payer) => {
    setEditingPayer(payer);
    setFormData({
      name: payer.name,
      cnpj: payer.cnpj || '',
      type: payer.type,
      email: payer.email || '',
      phone: payer.phone || '',
      city: payer.city || '',
      state: payer.state || '',
      address: payer.address || '',
      notes: payer.notes || '',
      active: payer.active,
    });
    setShowFormDialog(true);
  };

  const handleNew = () => {
    setEditingPayer(null);
    setFormData({
      name: '',
      cnpj: '',
      type: 'convenio',
      email: '',
      phone: '',
      city: '',
      state: '',
      address: '',
      notes: '',
      active: true,
    });
    setShowFormDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Nome obrigatório', {
        description: 'Informe o nome do convênio/prefeitura.',
      });
      return;
    }

    try {
      await payerMutation.mutateAsync({
        ...formData,
        id: editingPayer?.id,
      });
      setShowFormDialog(false);
    } catch (error) {
      console.error('Error saving payer:', error);
    }
  };

  const handleClose = () => {
    setShowFormDialog(false);
    setEditingPayer(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Convênios e Prefeituras</h1>
            <p className="text-muted-foreground">
              Cadastro de tomadores de serviço para faturamento
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Convênio
          </Button>
        </div>

        {/* Payers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Cadastro de Convênios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : payers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum convênio cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payers.map((payer) => (
                    <TableRow key={payer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(payer.type)}
                          <span className="text-sm">{getTypeLabel(payer.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{payer.name}</TableCell>
                      <TableCell>{payer.cnpj || '-'}</TableCell>
                      <TableCell>
                        {payer.city && payer.state
                          ? `${payer.city}/${payer.state}`
                          : payer.city || payer.state || '-'}
                      </TableCell>
                      <TableCell>
                        {payer.email || payer.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {payer.active ? (
                          <Badge className="bg-green-600">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(payer)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPayer ? 'Editar Convênio' : 'Novo Convênio'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Prefeitura Municipal de Silveirânia"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: PayerType) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            {t.icon}
                            {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj || ''}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Silveirânia"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="MG"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@prefeitura.gov.br"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(32) 3999-0000"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={payerMutation.isPending}>
                {payerMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
