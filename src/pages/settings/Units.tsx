import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Unit } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Building2 } from 'lucide-react';

export default function UnitsSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUnits();
    }
  }, [user, isAdmin]);

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('units')
        .select('*')
        .order('name');

      setUnits((data || []) as Unit[]);
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({ name, code: code.toUpperCase() })
          .eq('id', editingUnit.id);

        if (error) throw error;
        toast.success('Unidade atualizada!');
      } else {
        const { error } = await supabase.from('units').insert({
          name,
          code: code.toUpperCase(),
        });

        if (error) throw error;
        toast.success('Unidade criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUnits();
    } catch (error: any) {
      console.error('Error saving unit:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma unidade com este código');
      } else {
        toast.error('Erro ao salvar unidade');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setCode(unit.code);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUnit(null);
    setName('');
    setCode('');
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
            <h1 className="text-2xl font-bold text-foreground">Unidades</h1>
            <p className="text-muted-foreground">Gerencie as unidades do laboratório</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Rio Pomba"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Código (para etiquetas)</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex: RIOPOMBA"
                    required
                    pattern="[A-Z0-9]+"
                    title="Apenas letras maiúsculas e números"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para identificar os envelopes de fechamento
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingUnit ? 'Salvar' : 'Criar'}
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
                  <TableHead>Código</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma unidade cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map(unit => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {unit.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">{unit.code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(unit.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(unit)}>
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
