import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Account, CashClosing } from '@/types/database';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

export default function CashClosingPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  
  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedBalance, setExpectedBalance] = useState(0);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedAccountId && selectedDate) {
      calculateExpectedBalance();
    }
  }, [selectedAccountId, selectedDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ data: accountData }, { data: closingData }] = await Promise.all([
        supabase.from('accounts').select('*').eq('active', true),
        supabase
          .from('cash_closings')
          .select(`
            *,
            account:accounts(*)
          `)
          .order('date', { ascending: false })
          .limit(30),
      ]);

      setAccounts((accountData || []) as Account[]);
      setClosings((closingData || []) as unknown as CashClosing[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateExpectedBalance = async () => {
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    try {
      // Get all approved transactions up to the selected date
      const { data: txData } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('account_id', selectedAccountId)
        .eq('status', 'APROVADO')
        .lte('date', selectedDate)
        .is('deleted_at', null);

      const balance = (txData || []).reduce((sum, tx) => {
        return sum + (tx.type === 'ENTRADA' ? Number(tx.amount) : -Number(tx.amount));
      }, Number(account.initial_balance));

      setExpectedBalance(balance);
    } catch (error) {
      console.error('Error calculating balance:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedAccountId) return;

    const actual = parseFloat(actualBalance);
    if (isNaN(actual)) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const difference = actual - expectedBalance;
      
      const { error } = await supabase.from('cash_closings').insert({
        date: selectedDate,
        account_id: selectedAccountId,
        expected_balance: expectedBalance,
        actual_balance: actual,
        difference: difference,
        notes: notes || null,
        closed_by: user.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um fechamento para esta conta nesta data');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Fechamento de caixa registrado!');
      setActualBalance('');
      setNotes('');
      setSelectedAccountId('');
      fetchData();
    } catch (error) {
      console.error('Error creating closing:', error);
      toast.error('Erro ao registrar fechamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const difference = actualBalance ? parseFloat(actualBalance) - expectedBalance : 0;
  const hasDifference = Math.abs(difference) > 0.01;

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fechamento de Caixa</h1>
          <p className="text-muted-foreground">
            Compare o saldo físico com o saldo do sistema
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Novo Fechamento
              </CardTitle>
              <CardDescription>
                Informe o valor real em caixa para comparar com o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAccountId && (
                  <>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Saldo esperado (sistema)</p>
                      <p className="text-2xl font-bold text-foreground">
                        R$ {expectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Saldo real (contagem física)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={actualBalance}
                        onChange={e => setActualBalance(e.target.value)}
                        required
                      />
                    </div>

                    {actualBalance && (
                      <div className={`rounded-lg p-4 ${hasDifference ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {hasDifference ? (
                            <AlertTriangle className="w-5 h-5 text-warning" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-success" />
                          )}
                          <p className="font-medium">
                            {hasDifference ? 'Diferença encontrada' : 'Caixa conferido'}
                          </p>
                        </div>
                        <p className={`text-xl font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {difference >= 0 ? '+' : ''} R$ {difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Justificativa para diferença ou observações..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Registrar Fechamento
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Fechamentos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum fechamento registrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    closings.map(closing => {
                      const hasDiff = Math.abs(Number(closing.difference)) > 0.01;
                      return (
                        <TableRow key={closing.id}>
                          <TableCell>{format(new Date(closing.date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{closing.account?.name}</TableCell>
                          <TableCell className={hasDiff ? (Number(closing.difference) >= 0 ? 'text-success' : 'text-destructive') : ''}>
                            {hasDiff ? (
                              `${Number(closing.difference) >= 0 ? '+' : ''}R$ ${Number(closing.difference).toFixed(2)}`
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {hasDiff ? (
                              <Badge variant="secondary" className="bg-warning/20 text-warning">
                                Diferença
                              </Badge>
                            ) : (
                              <Badge className="bg-success text-success-foreground">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
