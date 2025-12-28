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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Account, AccountType, BankAccountType } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Building2, AlertTriangle, Star, Landmark } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const BANK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  operacional_principal: 'Operacional Principal',
  recebiveis_cartao_pix: 'Recebíveis Cartão/PIX',
  recebiveis_cartao_credito: 'Recebíveis Cartão Crédito',
  caixa: 'Caixa Físico',
  conta_bancaria: 'Conta Bancária',
};

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
  
  // Novos campos bancários
  const [institution, setInstitution] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankAccountType, setBankAccountType] = useState<BankAccountType | ''>('');
  const [isDefault, setIsDefault] = useState(false);
  const [holderName, setHolderName] = useState('');
  const [holderDocument, setHolderDocument] = useState('');

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
        .order('is_default', { ascending: false })
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

    if (!name) {
      toast.error('Informe o nome da conta');
      return;
    }

    setIsSubmitting(true);
    try {
      // Se marcando como default, desmarcar as outras primeiro
      if (isDefault && !editingAccount?.is_default) {
        await supabase
          .from('accounts')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const payload = {
        name,
        description: description || null,
        initial_balance: parseFloat(initialBalance) || 0,
        unit_id: unitId || null,
        type: accountType,
        institution: institution || null,
        institution_code: institutionCode || null,
        agency: agency || null,
        account_number: accountNumber || null,
        account_type: bankAccountType || null,
        is_default: isDefault,
        holder_name: holderName || null,
        holder_document: holderDocument || null,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update(payload)
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast.success('Conta atualizada!');
      } else {
        const { error } = await supabase.from('accounts').insert(payload);

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
    setInstitution(account.institution || '');
    setInstitutionCode(account.institution_code || '');
    setAgency(account.agency || '');
    setAccountNumber(account.account_number || '');
    setBankAccountType((account.account_type as BankAccountType) || '');
    setIsDefault(account.is_default || false);
    setHolderName(account.holder_name || '');
    setHolderDocument(account.holder_document || '');
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
    setInstitution('');
    setInstitutionCode('');
    setAgency('');
    setAccountNumber('');
    setBankAccountType('');
    setIsDefault(false);
    setHolderName('');
    setHolderDocument('');
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
            <h1 className="text-2xl font-bold text-foreground">Contas Bancárias</h1>
            <p className="text-muted-foreground">Gerencie contas bancárias, caixas e operadoras por unidade</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados básicos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Nome da Conta *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ex: BB Operacional Labclin"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo Geral</Label>
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
                    <Label>Finalidade</Label>
                    <Select value={bankAccountType} onValueChange={v => setBankAccountType(v as BankAccountType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operacional_principal">Operacional Principal</SelectItem>
                        <SelectItem value="recebiveis_cartao_pix">Recebíveis Cartão/PIX</SelectItem>
                        <SelectItem value="recebiveis_cartao_credito">Recebíveis Cartão Crédito</SelectItem>
                        <SelectItem value="caixa">Caixa Físico</SelectItem>
                        <SelectItem value="conta_bancaria">Conta Bancária Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dados bancários */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      Dados Bancários
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="institution">Instituição</Label>
                      <Input
                        id="institution"
                        value={institution}
                        onChange={e => setInstitution(e.target.value)}
                        placeholder="Ex: Banco do Brasil"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="institutionCode">Código Banco</Label>
                      <Input
                        id="institutionCode"
                        value={institutionCode}
                        onChange={e => setInstitutionCode(e.target.value)}
                        placeholder="Ex: 001"
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agency">Agência</Label>
                      <Input
                        id="agency"
                        value={agency}
                        onChange={e => setAgency(e.target.value)}
                        placeholder="Ex: 487-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Número da Conta</Label>
                      <Input
                        id="accountNumber"
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        placeholder="Ex: 5749-5"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Titular */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="holderName">Titular</Label>
                    <Input
                      id="holderName"
                      value={holderName}
                      onChange={e => setHolderName(e.target.value)}
                      placeholder="Nome do titular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holderDocument">CNPJ/CPF Titular</Label>
                    <Input
                      id="holderDocument"
                      value={holderDocument}
                      onChange={e => setHolderDocument(e.target.value)}
                      placeholder="Documento do titular"
                    />
                  </div>
                </div>

                {/* Unidade e Saldo */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade (opcional)</Label>
                    <UnitSelector
                      value={unitId}
                      onChange={setUnitId}
                      placeholder="Todas as unidades"
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
                </div>

                {/* Descrição */}
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

                {/* Conta padrão */}
                <div className="flex items-center space-x-3 p-4 border rounded-lg bg-muted/30">
                  <Checkbox
                    id="is_default"
                    checked={isDefault}
                    onCheckedChange={(checked) => setIsDefault(checked === true)}
                  />
                  <div>
                    <Label htmlFor="is_default" className="cursor-pointer flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Conta padrão para pagamentos
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Será sugerida automaticamente ao criar novas contas a pagar
                    </p>
                  </div>
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
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência / Conta</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map(account => (
                    <TableRow key={account.id} className={!account.unit_id ? 'bg-yellow-500/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {account.is_default && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              </TooltipTrigger>
                              <TooltipContent>Conta padrão para pagamentos</TooltipContent>
                            </Tooltip>
                          )}
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p>{account.name}</p>
                            {account.account_type && (
                              <p className="text-xs text-muted-foreground">
                                {BANK_ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {account.institution ? (
                          <div className="flex items-center gap-2">
                            {account.institution_code && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {account.institution_code}
                              </Badge>
                            )}
                            <span className="text-sm">{account.institution}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.agency || account.account_number ? (
                          <span className="font-mono text-sm">
                            {account.agency && `Ag ${account.agency}`}
                            {account.agency && account.account_number && ' • '}
                            {account.account_number && `Cc ${account.account_number}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.unit?.name ? (
                          <span className="text-muted-foreground">{account.unit.name}</span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="border-yellow-500 text-yellow-600 gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Sem unidade
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Conta compartilhada entre todas as unidades</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {getAccountTypeBadge(account.type || 'CAIXA')}
                      </TableCell>
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
