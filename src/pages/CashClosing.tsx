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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UnitSelector } from '@/components/UnitSelector';
import { supabase } from '@/integrations/supabase/client';
import { Account, CashClosing, Unit } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Calculator, AlertTriangle, CheckCircle, Download, Printer, Tag } from 'lucide-react';
import { generateClosingZpl, generateEnvelopeId, downloadZplFile, ZplClosingData } from '@/utils/zpl';

export default function CashClosingPage() {
  const navigate = useNavigate();
  const { user, profile, unit: userUnit, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Form state
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedBalance, setExpectedBalance] = useState(0);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // ZPL Dialog
  const [zplDialogOpen, setZplDialogOpen] = useState(false);
  const [lastClosing, setLastClosing] = useState<{ zpl: string; envelopeId: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
      // Se secretária, define a unidade automaticamente
      if (!isAdmin && userUnit) {
        setSelectedUnitId(userUnit.id);
      }
    }
  }, [user, userUnit, isAdmin]);

  useEffect(() => {
    if (selectedUnitId && selectedAccountId && selectedDate) {
      calculateExpectedBalance();
    }
  }, [selectedUnitId, selectedAccountId, selectedDate]);

  // Quando unidade muda, atualiza lista de contas
  useEffect(() => {
    if (selectedUnitId) {
      setSelectedAccountId('');
    }
  }, [selectedUnitId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch units
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name');
      
      setUnits((unitsData || []) as Unit[]);

      // Fetch accounts
      const { data: accountData } = await supabase
        .from('accounts')
        .select('*, unit:units(*)')
        .eq('active', true);

      setAccounts((accountData || []) as Account[]);

      // Fetch closings
      let closingsQuery = supabase
        .from('cash_closings')
        .select(`
          *,
          account:accounts(*),
          unit:units(*)
        `)
        .order('date', { ascending: false })
        .limit(30);

      // Se não for admin e tiver unidade, filtra
      if (!isAdmin && userUnit) {
        closingsQuery = closingsQuery.eq('unit_id', userUnit.id);
      }

      const { data: closingData } = await closingsQuery;
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
      // Get all approved CASH transactions up to the selected date for the unit
      let query = supabase
        .from('transactions')
        .select('type, amount')
        .eq('account_id', selectedAccountId)
        .eq('status', 'APROVADO')
        .eq('payment_method', 'DINHEIRO')
        .lte('date', selectedDate)
        .is('deleted_at', null);

      if (selectedUnitId) {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data: txData } = await query;

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
    if (!user || !selectedAccountId || !selectedUnitId) return;

    const actual = parseFloat(actualBalance);
    if (isNaN(actual)) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const difference = actual - expectedBalance;
      const selectedUnit = units.find(u => u.id === selectedUnitId);
      
      // Count existing closings for this unit and date to generate sequence
      const { count } = await supabase
        .from('cash_closings')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', selectedUnitId)
        .eq('date', selectedDate);

      const sequence = (count || 0) + 1;
      const envelopeId = generateEnvelopeId(selectedUnit?.code || 'UNIT', selectedDate, sequence);
      
      const { error } = await supabase.from('cash_closings').insert({
        date: selectedDate,
        account_id: selectedAccountId,
        unit_id: selectedUnitId,
        expected_balance: expectedBalance,
        actual_balance: actual,
        difference: difference,
        notes: notes || null,
        envelope_id: envelopeId,
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

      // Generate ZPL
      const zplData: ZplClosingData = {
        unitName: selectedUnit?.name || 'Unidade',
        unitCode: selectedUnit?.code || 'UNIT',
        date: format(new Date(selectedDate), 'dd/MM/yyyy'),
        actualBalance: actual,
        envelopeId: envelopeId,
        closedByName: profile?.name || 'Usuário',
      };

      const zplContent = generateClosingZpl(zplData);
      setLastClosing({ zpl: zplContent, envelopeId });
      setZplDialogOpen(true);

      toast.success('Fechamento de caixa registrado!');
      setActualBalance('');
      setNotes('');
      if (isAdmin) {
        setSelectedUnitId('');
        setSelectedAccountId('');
      } else {
        setSelectedAccountId('');
      }
      fetchData();
    } catch (error) {
      console.error('Error creating closing:', error);
      toast.error('Erro ao registrar fechamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadZpl = () => {
    if (lastClosing) {
      downloadZplFile(lastClosing.zpl, `etiqueta-${lastClosing.envelopeId}.zpl`);
    }
  };

  const difference = actualBalance ? parseFloat(actualBalance) - expectedBalance : 0;
  const hasDifference = Math.abs(difference) > 0.01;

  // Filter accounts by selected unit
  const filteredAccounts = accounts.filter(a => 
    a.unit_id === selectedUnitId && a.type === 'CAIXA'
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fechamento de Caixa</h1>
          <p className="text-muted-foreground">
            Compare o saldo físico com o saldo do sistema e gere a etiqueta do envelope
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
                  <Label>Unidade</Label>
                  {isAdmin ? (
                    <UnitSelector
                      value={selectedUnitId}
                      onChange={setSelectedUnitId}
                      placeholder="Selecione a unidade..."
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <span className="text-sm font-medium">{userUnit?.name || 'Sem unidade'}</span>
                    </div>
                  )}
                </div>

                {selectedUnitId && (
                  <div className="space-y-2">
                    <Label>Caixa Dinheiro</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o caixa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhum caixa cadastrado para esta unidade
                          </SelectItem>
                        ) : (
                          filteredAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedAccountId && (
                  <>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Saldo esperado (sistema)</p>
                      <p className="text-2xl font-bold text-foreground">
                        R$ {expectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Baseado em transações APROVADAS em DINHEIRO
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
                      <Tag className="w-4 h-4 mr-2" />
                      Confirmar Fechamento e Gerar Etiqueta
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
                    <TableHead>Unidade</TableHead>
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
                          <TableCell>
                            <div>
                              <span>{format(new Date(closing.date), 'dd/MM/yyyy')}</span>
                              {closing.envelope_id && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {closing.envelope_id}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{closing.unit?.name || '—'}</TableCell>
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

        {/* ZPL Dialog */}
        <Dialog open={zplDialogOpen} onOpenChange={setZplDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Etiqueta do Envelope
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2">ID do Envelope:</p>
                <p className="font-mono text-lg">{lastClosing?.envelopeId}</p>
              </div>
              
              <div className="bg-accent/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Código ZPL:</p>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {lastClosing?.zpl}
                </pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownloadZpl} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar arquivo .zpl
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(lastClosing?.zpl || '');
                    toast.success('ZPL copiado!');
                  }}
                >
                  Copiar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Envie o arquivo .zpl para sua impressora Zebra ou cole o código diretamente no software de impressão.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
