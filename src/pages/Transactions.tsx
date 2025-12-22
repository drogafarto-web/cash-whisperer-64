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
import { UnitSelector } from '@/components/UnitSelector';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Account, Category, Document, OcrData, TransactionType, PaymentMethod, Unit, Partner } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  Upload, 
  Check, 
  X, 
  Eye,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function Transactions() {
  const navigate = useNavigate();
  const { user, role, isAdmin, unit: userUnit, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Filter state (for admin)
  const [filterUnitId, setFilterUnitId] = useState<string>('all');
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    type: 'SAIDA' as TransactionType,
    payment_method: 'PIX' as PaymentMethod,
    account_id: '',
    category_id: '',
    partner_id: '',
    description: '',
    unit_id: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      // Para secretária, define a unidade automaticamente
      if (!isAdmin && userUnit) {
        setFormData(prev => ({ ...prev, unit_id: userUnit.id }));
      }
      fetchData();
    }
  }, [user, userUnit, isAdmin]);

  // Refetch when filter changes
  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [filterUnitId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTransactions(),
        fetchAccountsAndCategories(),
        fetchUnits(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*),
        account:accounts(*),
        partner:partners(*),
        unit:units(*),
        documents(*)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply filter for admin
    if (isAdmin && filterUnitId && filterUnitId !== 'all') {
      query = query.eq('unit_id', filterUnitId);
    }

    const { data: txData } = await query;
    setTransactions((txData || []) as unknown as Transaction[]);
  };

  const fetchAccountsAndCategories = async () => {
    const [{ data: accountData }, { data: categoryData }, { data: partnerData }] = await Promise.all([
      supabase.from('accounts').select('*, unit:units(*)').eq('active', true),
      supabase.from('categories').select('*').eq('active', true),
      supabase.from('partners').select('*, default_category:categories(*)').eq('active', true),
    ]);

    setAccounts((accountData || []) as Account[]);
    setCategories((categoryData || []) as Category[]);
    setPartners((partnerData || []) as Partner[]);
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits((data || []) as Unit[]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    // Process OCR for images
    if (selectedFile.type.startsWith('image/')) {
      setIsProcessingOcr(true);
      try {
        const base64 = await fileToBase64(selectedFile);
        
        const response = await supabase.functions.invoke('ocr-receipt', {
          body: { imageBase64: base64, mimeType: selectedFile.type }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const { ocrData: extractedData } = response.data;
        setOcrData(extractedData);

        // Auto-fill form with OCR data
        if (extractedData && !extractedData.error) {
          if (extractedData.valor) {
            setFormData(prev => ({ ...prev, amount: String(extractedData.valor) }));
          }
          if (extractedData.data) {
            setFormData(prev => ({ ...prev, date: extractedData.data }));
          }
          if (extractedData.descricao) {
            setFormData(prev => ({ ...prev, description: extractedData.descricao }));
          }
          toast.success(`OCR processado com ${extractedData.confianca || 0}% de confiança`);
        }
      } catch (error) {
        console.error('OCR error:', error);
        toast.error('Erro ao processar comprovante com OCR');
      } finally {
        setIsProcessingOcr(false);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.account_id || !formData.category_id) {
      toast.error('Selecione conta e categoria');
      return;
    }

    if (!formData.unit_id) {
      toast.error('Selecione a unidade');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create transaction
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          ...formData,
          partner_id: formData.partner_id || null,
          amount: parseFloat(formData.amount),
          created_by: user.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Upload document if exists
      if (file && txData) {
        const fileName = `${txData.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (!uploadError) {
          await supabase.from('documents').insert([{
            transaction_id: txData.id,
            file_path: fileName,
            file_name: file.name,
            file_type: file.type,
            ocr_data: ocrData as any,
          }]);
        }
      }

      toast.success('Transação criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Erro ao criar transação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (tx: Transaction) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'APROVADO',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (error) throw error;
      toast.success('Transação aprovada!');
      fetchTransactions();
    } catch (error) {
      console.error('Error approving transaction:', error);
      toast.error('Erro ao aprovar transação');
    }
  };

  const handleReject = async (tx: Transaction, reason: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'REJEITADO',
          rejection_reason: reason,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (error) throw error;
      toast.success('Transação rejeitada');
      fetchTransactions();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      toast.error('Erro ao rejeitar transação');
    }
  };

  const handleSoftDelete = async (tx: Transaction) => {
    if (!user || !isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', tx.id);

      if (error) throw error;
      toast.success('Transação removida');
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Erro ao remover transação');
    }
  };

  const viewDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);
    
    if (data?.signedUrl) {
      setDocumentPreviewUrl(data.signedUrl);
    }
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      type: 'SAIDA',
      payment_method: 'PIX',
      account_id: '',
      category_id: '',
      partner_id: '',
      description: '',
      unit_id: !isAdmin && userUnit ? userUnit.id : '',
    });
    setFile(null);
    setOcrData(null);
  };

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId);
    setFormData(prev => ({
      ...prev,
      partner_id: partnerId,
      category_id: partner?.default_category_id || prev.category_id,
    }));
  };

  const handleTypeChange = (type: TransactionType) => {
    setFormData(prev => ({ 
      ...prev, 
      type, 
      category_id: '', 
      partner_id: '' 
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROVADO':
        return <Badge className="bg-success text-success-foreground">Aprovado</Badge>;
      case 'REJEITADO':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary" className="bg-warning/20 text-warning">Pendente</Badge>;
    }
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);
  
  // Filter partners by type (CLIENTE for ENTRADA, FORNECEDOR for SAIDA)
  const filteredPartners = partners.filter(p => 
    (formData.type === 'ENTRADA' && p.type === 'CLIENTE') ||
    (formData.type === 'SAIDA' && p.type === 'FORNECEDOR')
  );
  
  // Filter accounts by selected unit in form
  const filteredAccounts = formData.unit_id 
    ? accounts.filter(a => a.unit_id === formData.unit_id)
    : accounts;

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
        {/* Header com botão destacado à esquerda */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Transações</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="shadow-md">
                  <Plus className="w-5 h-5 mr-2" />
                  Nova Transação
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Unit selector */}
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  {isAdmin ? (
                    <UnitSelector
                      value={formData.unit_id}
                      onChange={value => setFormData(prev => ({ ...prev, unit_id: value, account_id: '' }))}
                      placeholder="Selecione a unidade..."
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <span className="text-sm font-medium">{userUnit?.name || 'Sem unidade'}</span>
                    </div>
                  )}
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Comprovante (opcional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessingOcr}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {isProcessingOcr ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                          <span>Processando OCR...</span>
                        </div>
                      ) : file ? (
                        <div className="flex items-center justify-center gap-2 text-success">
                          <Check className="w-5 h-5" />
                          <span>{file.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-8 h-8" />
                          <span>Clique para enviar comprovante</span>
                          <span className="text-xs">Imagens serão processadas com OCR</span>
                        </div>
                      )}
                    </label>
                  </div>
                  {ocrData && !ocrData.error && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Dados extraídos automaticamente via OCR
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={value => handleTypeChange(value as TransactionType)}
                    >
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
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={value => setFormData(prev => ({ ...prev, payment_method: value as PaymentMethod }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                        <SelectItem value="CARTAO">Cartão</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="BOLETO">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Parceiro selector */}
                <div className="space-y-2">
                  <Label>Parceiro (opcional)</Label>
                  <Select
                    value={formData.partner_id}
                    onValueChange={handlePartnerChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {filteredPartners.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            {p.name}
                            {p.is_recurring && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={value => setFormData(prev => ({ ...prev, account_id: value }))}
                      disabled={!formData.unit_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!formData.unit_id ? "Selecione unidade primeiro" : "Selecione..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={value => setFormData(prev => ({ ...prev, category_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Detalhes da transação..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Transação
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
          {/* Texto guia contextual para secretária */}
          <p className="text-sm text-muted-foreground">
            Registre todas as entradas e saídas do dia aqui antes de fazer o fechamento de caixa.
          </p>
        </div>

        {/* Filters for Admin */}
        {isAdmin && (
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 max-w-xs">
                <UnitSelector
                  value={filterUnitId}
                  onChange={setFilterUnitId}
                  showAllOption
                  placeholder="Filtrar por unidade..."
                />
              </div>
            </div>
          </Card>
        )}

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {isAdmin && <TableHead>Unidade</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Parceiro</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Conta</TableHead>
                  {isAdmin && <TableHead>Status</TableHead>}
                  <TableHead className="text-right">{isAdmin ? 'Ações' : 'Documento'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-8 text-muted-foreground">
                      Nenhuma transação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                      {isAdmin && <TableCell className="text-muted-foreground">{tx.unit?.name || '—'}</TableCell>}
                      <TableCell>
                        <Badge variant={tx.type === 'ENTRADA' ? 'default' : 'secondary'}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={tx.type === 'ENTRADA' ? 'text-success font-medium' : 'text-destructive font-medium'}>
                        {tx.type === 'ENTRADA' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {tx.partner ? (
                          <div className="flex items-center gap-1">
                            <span>{tx.partner.name}</span>
                            {tx.partner.is_recurring && (
                              <RefreshCw className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{tx.category?.name}</TableCell>
                      <TableCell className="hidden lg:table-cell">{tx.account?.name}</TableCell>
                      {isAdmin && <TableCell>{getStatusBadge(tx.status)}</TableCell>}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {tx.documents && tx.documents.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewDocument(tx.documents![0])}
                            >
                              {tx.documents[0].file_type.includes('pdf') ? (
                                <FileText className="w-4 h-4" />
                              ) : (
                                <ImageIcon className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {isAdmin && tx.status === 'PENDENTE' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-success hover:text-success"
                                onClick={() => handleApprove(tx)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleReject(tx, 'Rejeitado pelo administrador')}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Document Preview Dialog */}
        <Dialog open={!!selectedDocument} onOpenChange={() => { setSelectedDocument(null); setDocumentPreviewUrl(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedDocument?.file_name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              {documentPreviewUrl && (
                selectedDocument?.file_type.includes('pdf') ? (
                  <iframe
                    src={documentPreviewUrl}
                    className="w-full h-[70vh] border rounded-lg"
                  />
                ) : (
                  <img
                    src={documentPreviewUrl}
                    alt={selectedDocument?.file_name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                )
              )}
            </div>
            {selectedDocument?.ocr_data && !selectedDocument.ocr_data.error && (
              <div className="bg-accent/50 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Dados extraídos via OCR
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedDocument.ocr_data.valor && (
                    <p>Valor: R$ {selectedDocument.ocr_data.valor}</p>
                  )}
                  {selectedDocument.ocr_data.data && (
                    <p>Data: {selectedDocument.ocr_data.data}</p>
                  )}
                  {selectedDocument.ocr_data.fornecedor && (
                    <p>Fornecedor: {selectedDocument.ocr_data.fornecedor}</p>
                  )}
                  {selectedDocument.ocr_data.confianca && (
                    <p>Confiança: {selectedDocument.ocr_data.confianca}%</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
