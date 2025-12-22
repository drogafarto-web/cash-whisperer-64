import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { UnitSelector } from '@/components/UnitSelector';
import { supabase } from '@/integrations/supabase/client';
import { Account, AccountType, Unit } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Building2 } from 'lucide-react';

export default function AccountsSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [unitId, setUnitId] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CAIXA');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAccounts();
    }
  }, [user, isAdmin]);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('accounts')
        .select('*, unit:units(*)')
        .order('name');

      setAccounts((data || []) as Account[]);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitId) {
      toast.error('Selecione uma unidade');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name,
            description: description || null,
            initial_balance: parseFloat(initialBalance) || 0,
            unit_id: unitId,
            type: accountType,
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast.success('Conta atualizada!');
      } else {
        const { error } = await supabase.from('accounts').insert({
          name,
          description: description || null,
          initial_balance: parseFloat(initialBalance) || 0,
          unit_id: unitId,
          type: accountType,
        });

        if (error) throw error;
        toast.success('Conta criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error('Erro ao salvar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setName(account.name);
    setDescription(account.description || '');
    setInitialBalance(String(account.initial_balance));
    setUnitId(account.unit_id || '');
    setAccountType((account.type as AccountType) || 'CAIXA');
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (account: Account) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ active: !account.active })
        .eq('id', account.id);

      if (error) throw error;
      toast.success(account.active ? 'Conta desativada' : 'Conta ativada');
      fetchAccounts();
    } catch (error) {
      console.error('Error toggling account:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setDescription('');
    setInitialBalance('');
    setUnitId('');
    setAccountType('CAIXA');
  };

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case 'CAIXA':
        return <Badge variant="default">Caixa</Badge>;
      case 'CONTA_BANCARIA':
        return <Badge variant="secondary">Conta Bancária</Badge>;
      case 'OPERADORA_CARTAO':
        return <Badge variant="outline">Operadora Cartão</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
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
            <h1 className="text-2xl font-bold text-foreground">Contas</h1>
            <p className="text-muted-foreground">Gerencie as contas bancárias e caixas por unidade</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <UnitSelector
                    value={unitId}
                    onChange={setUnitId}
                    placeholder="Selecione a unidade..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Caixa Dinheiro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Conta</Label>
                  <Select value={accountType} onValueChange={v => setAccountType(v as AccountType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAIXA">Caixa (Dinheiro)</SelectItem>
                      <SelectItem value="CONTA_BANCARIA">Conta Bancária</SelectItem>
                      <SelectItem value="OPERADORA_CARTAO">Operadora de Cartão</SelectItem>
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
                <div className="space-y-2">
                  <Label htmlFor="balance">Saldo Inicial (R$)</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingAccount ? 'Salvar' : 'Criar'}
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
                  <TableHead>Unidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo Inicial</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {account.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.unit?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {getAccountTypeBadge(account.type || 'CAIXA')}
                      </TableCell>
                      <TableCell>R$ {Number(account.initial_balance).toFixed(2)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={account.active}
                          onCheckedChange={() => handleToggleActive(account)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
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
