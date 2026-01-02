import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Partner, PartnerType, Category, Unit } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, RefreshCw, Users, Building2, UserCircle } from 'lucide-react';

export default function PartnersSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<PartnerType>('CLIENTE');
  const [unitId, setUnitId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [partnersRes, categoriesRes, unitsRes] = await Promise.all([
        supabase
          .from('partners')
          .select('*, default_category:categories(*), unit:units(id, name)')
          .order('name'),
        supabase
          .from('categories')
          .select('*')
          .eq('active', true)
          .order('name'),
        supabase
          .from('units')
          .select('id, name')
          .order('name'),
      ]);

      setPartners((partnersRes.data || []) as Partner[]);
      setCategories((categoriesRes.data || []) as Category[]);
      setUnits((unitsRes.data || []) as Unit[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('CLIENTE');
    setUnitId('');
    setIsRecurring(false);
    setDefaultCategoryId('');
    setExpectedAmount('');
    setNotes('');
    setActive(true);
    setEditingPartner(null);
  };

  const openEditDialog = (partner: Partner) => {
    setEditingPartner(partner);
    setName(partner.name);
    setType(partner.type);
    setUnitId(partner.unit_id || '');
    setIsRecurring(partner.is_recurring);
    setDefaultCategoryId(partner.default_category_id || '');
    setExpectedAmount(partner.expected_amount?.toString() || '');
    setNotes(partner.notes || '');
    setActive(partner.active);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validação: Funcionário requer unidade e salário
    if (type === 'FUNCIONARIO') {
      if (!unitId) {
        toast.error('Funcionário requer uma unidade vinculada');
        return;
      }
      if (!expectedAmount || parseFloat(expectedAmount) <= 0) {
        toast.error('Funcionário requer salário cadastrado');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const partnerData = {
        name: name.trim(),
        type,
        unit_id: type === 'FUNCIONARIO' ? unitId : null,
        is_recurring: type === 'FUNCIONARIO' ? true : isRecurring,
        default_category_id: defaultCategoryId || null,
        expected_amount: expectedAmount ? parseFloat(expectedAmount) : null,
        notes: notes.trim() || null,
        active,
      };

      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update(partnerData)
          .eq('id', editingPartner.id);

        if (error) throw error;
        toast.success('Parceiro atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('partners')
          .insert(partnerData);

        if (error) throw error;
        toast.success('Parceiro criado com sucesso!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving partner:', error);
      toast.error('Erro ao salvar parceiro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => {
    if (type === 'CLIENTE') return c.type === 'ENTRADA';
    // FUNCIONARIO e FORNECEDOR usam SAIDA
    return c.type === 'SAIDA';
  });

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parceiros</h1>
            <p className="text-muted-foreground">Clientes, convênios e fornecedores</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Parceiro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPartner ? 'Editar Parceiro' : 'Novo Parceiro'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nome do parceiro"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={type} onValueChange={value => {
                    setType(value as PartnerType);
                    setDefaultCategoryId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLIENTE">
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Cliente / Convênio
                        </span>
                      </SelectItem>
                      <SelectItem value="FORNECEDOR">
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Fornecedor
                        </span>
                      </SelectItem>
                      <SelectItem value="FUNCIONARIO">
                        <span className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4" />
                          Funcionário
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {type === 'FUNCIONARIO' && (
                  <div className="space-y-2">
                    <Label>Unidade *</Label>
                    <Select value={unitId} onValueChange={setUnitId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A folha de pagamento será vinculada aos funcionários desta unidade
                    </p>
                  </div>
                )}

                {type !== 'FUNCIONARIO' && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="recurring">Recorrência Mensal</Label>
                      <p className="text-xs text-muted-foreground">
                        Pagamento/recebimento todo mês
                      </p>
                    </div>
                    <Switch
                      id="recurring"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Categoria Padrão</Label>
                  <Select value={defaultCategoryId || 'none'} onValueChange={value => setDefaultCategoryId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {filteredCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedAmount">
                    {type === 'FUNCIONARIO' ? 'Salário (R$) *' : 'Valor Esperado (R$)'}
                  </Label>
                  <Input
                    id="expectedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={expectedAmount}
                    onChange={e => setExpectedAmount(e.target.value)}
                    placeholder={type === 'FUNCIONARIO' ? 'Ex: 2500.00' : 'Ex: 700.00'}
                    required={type === 'FUNCIONARIO'}
                  />
                  {type === 'FUNCIONARIO' && (
                    <p className="text-xs text-muted-foreground">
                      Este valor será usado para criar os lançamentos de folha
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Informações adicionais..."
                    rows={2}
                  />
                </div>

                {editingPartner && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Ativo</Label>
                    <Switch
                      id="active"
                      checked={active}
                      onCheckedChange={setActive}
                    />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingPartner ? 'Salvar Alterações' : 'Criar Parceiro'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum parceiro cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  partners.map(partner => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={partner.type === 'FUNCIONARIO' ? 'outline' : partner.type === 'CLIENTE' ? 'default' : 'secondary'}
                          className={partner.type === 'FUNCIONARIO' ? 'border-blue-500 text-blue-600' : ''}
                        >
                          {partner.type === 'FUNCIONARIO' 
                            ? 'Funcionário' 
                            : partner.type === 'CLIENTE' 
                              ? 'Cliente' 
                              : 'Fornecedor'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {partner.unit?.name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {partner.is_recurring ? (
                          <Badge variant="outline" className="gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Recorrente
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Pontual</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {partner.expected_amount ? (
                          <span className={partner.type === 'FUNCIONARIO' ? 'font-medium' : ''}>
                            R$ {partner.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {partner.type === 'FUNCIONARIO' && (
                              <span className="text-xs text-muted-foreground ml-1">/mês</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.active ? 'outline' : 'secondary'}>
                          {partner.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(partner)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
