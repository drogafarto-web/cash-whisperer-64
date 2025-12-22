import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Category, TaxGroup, RecurrenceType } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, RefreshCw, Zap, Calculator } from 'lucide-react';

const TAX_GROUP_OPTIONS: { value: TaxGroup; label: string }[] = [
  { value: 'RECEITA_SERVICOS', label: 'Receita de Serviços' },
  { value: 'RECEITA_OUTRAS', label: 'Outras Receitas' },
  { value: 'INSUMOS', label: 'Insumos e Materiais' },
  { value: 'PESSOAL', label: 'Pessoal e Encargos' },
  { value: 'SERVICOS_TERCEIROS', label: 'Serviços de Terceiros' },
  { value: 'ADMINISTRATIVAS', label: 'Despesas Administrativas' },
  { value: 'FINANCEIRAS', label: 'Despesas Financeiras' },
  { value: 'TRIBUTARIAS', label: 'Impostos e Tributos' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string; icon: React.ReactNode }[] = [
  { value: 'RECORRENTE', label: 'Recorrente (fixa/mensal)', icon: <RefreshCw className="w-3 h-3" /> },
  { value: 'NAO_RECORRENTE', label: 'Não Recorrente (variável)', icon: <Zap className="w-3 h-3" /> },
];

export default function CategoriesSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'ENTRADA' | 'SAIDA'>('SAIDA');
  const [taxGroup, setTaxGroup] = useState<TaxGroup | ''>('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('');
  const [description, setDescription] = useState('');
  const [entraFatorR, setEntraFatorR] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchCategories();
    }
  }, [user, isAdmin]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('type')
        .order('name');

      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name,
            type,
            tax_group: taxGroup || null,
            recurrence_type: recurrenceType || null,
            description: description || null,
            entra_fator_r: entraFatorR,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Categoria atualizada!');
      } else {
        const { error } = await supabase.from('categories').insert({
          name,
          type,
          tax_group: taxGroup || null,
          recurrence_type: recurrenceType || null,
          description: description || null,
          entra_fator_r: entraFatorR,
        });

        if (error) throw error;
        toast.success('Categoria criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Erro ao salvar categoria');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setType(category.type as 'ENTRADA' | 'SAIDA');
    setTaxGroup(category.tax_group || '');
    setRecurrenceType(category.recurrence_type || '');
    setDescription(category.description || '');
    setEntraFatorR(category.entra_fator_r);
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ active: !category.active })
        .eq('id', category.id);

      if (error) throw error;
      toast.success(category.active ? 'Categoria desativada' : 'Categoria ativada');
      fetchCategories();
    } catch (error) {
      console.error('Error toggling category:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setName('');
    setType('SAIDA');
    setTaxGroup('');
    setRecurrenceType('');
    setDescription('');
    setEntraFatorR(false);
  };

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
            <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
            <p className="text-muted-foreground">Gerencie as categorias contábeis</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Fornecedores"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={value => setType(value as 'ENTRADA' | 'SAIDA')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRADA">Entrada</SelectItem>
                      <SelectItem value="SAIDA">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo Tributário</Label>
                  <Select
                    value={taxGroup || 'none'}
                    onValueChange={(value) => setTaxGroup(value === 'none' ? '' : (value as TaxGroup))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {TAX_GROUP_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Recorrência</Label>
                  <Select
                    value={recurrenceType || 'none'}
                    onValueChange={(value) => setRecurrenceType(value === 'none' ? '' : (value as RecurrenceType))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não definido</SelectItem>
                      {RECURRENCE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Descrição opcional..."
                    rows={2}
                  />
                </div>
                {taxGroup === 'PESSOAL' && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-primary" />
                      <div>
                        <Label htmlFor="entraFatorR" className="text-sm font-medium">
                          Entra no Fator R
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Inclui no cálculo do Fator R (Simples Nacional)
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="entraFatorR"
                      checked={entraFatorR}
                      onCheckedChange={setEntraFatorR}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingCategory ? 'Salvar' : 'Criar'}
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
                  <TableHead>Grupo Tributário</TableHead>
                  <TableHead>Recorrência</TableHead>
                  <TableHead className="text-center">Fator R</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma categoria cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map(category => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        <Badge variant={category.type === 'ENTRADA' ? 'default' : 'secondary'}>
                          {category.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {category.tax_group ? (
                          <Badge variant="outline" className="text-xs">
                            {TAX_GROUP_OPTIONS.find(o => o.value === category.tax_group)?.label || category.tax_group}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.recurrence_type ? (
                          <Badge 
                            variant={category.recurrence_type === 'RECORRENTE' ? 'default' : 'secondary'}
                            className="text-xs gap-1"
                          >
                            {category.recurrence_type === 'RECORRENTE' ? (
                              <><RefreshCw className="w-3 h-3" /> Recorrente</>
                            ) : (
                              <><Zap className="w-3 h-3" /> Variável</>
                            )}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {category.tax_group === 'PESSOAL' ? (
                          category.entra_fator_r ? (
                            <Badge className="bg-green-100 text-green-800 gap-1">
                              <Calculator className="w-3 h-3" /> Sim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.active}
                          onCheckedChange={() => handleToggleActive(category)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
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
