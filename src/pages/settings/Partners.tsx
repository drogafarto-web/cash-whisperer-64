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
import { Partner, PartnerType, Category } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, RefreshCw, Users, Building2 } from 'lucide-react';

export default function PartnersSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<PartnerType>('CLIENTE');
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
      const [partnersRes, categoriesRes] = await Promise.all([
        supabase
          .from('partners')
          .select('*, default_category:categories(*)')
          .order('name'),
        supabase
          .from('categories')
          .select('*')
          .eq('active', true)
          .order('name'),
      ]);

      setPartners((partnersRes.data || []) as Partner[]);
      setCategories((categoriesRes.data || []) as Category[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('CLIENTE');
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

    setIsSubmitting(true);
    try {
      const partnerData = {
        name: name.trim(),
        type,
        is_recurring: isRecurring,
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

  const filteredCategories = categories.filter(c => 
    type === 'CLIENTE' ? c.type === 'ENTRADA' : c.type === 'SAIDA'
  );

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
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="space-y-2">
                  <Label>Categoria Padrão</Label>
                  <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {filteredCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedAmount">Valor Esperado (R$)</Label>
                  <Input
                    id="expectedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={expectedAmount}
                    onChange={e => setExpectedAmount(e.target.value)}
                    placeholder="Ex: 700.00"
                  />
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
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Categoria Padrão</TableHead>
                  <TableHead>Valor Esperado</TableHead>
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
                        <Badge variant={partner.type === 'CLIENTE' ? 'default' : 'secondary'}>
                          {partner.type === 'CLIENTE' ? 'Cliente' : 'Fornecedor'}
                        </Badge>
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
                        {partner.default_category?.name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {partner.expected_amount ? (
                          `R$ ${partner.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
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
