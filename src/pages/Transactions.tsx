import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Account, Category, Document, Unit, Partner } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, Info } from 'lucide-react';
import {
  TransactionForm,
  TransactionFilters,
  TransactionTable,
  DocumentPreviewDialog,
} from '@/components/transactions';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, userUnit, isAdmin]);

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

    if (isAdmin) {
      if (filterUnitId && filterUnitId !== 'all') {
        query = query.eq('unit_id', filterUnitId);
      }
    } else if (userUnit) {
      query = query.eq('unit_id', userUnit.id);
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

  const viewDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);
    
    if (data?.signedUrl) {
      setDocumentPreviewUrl(data.signedUrl);
    }
  };

  const closeDocumentPreview = () => {
    setSelectedDocument(null);
    setDocumentPreviewUrl(null);
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
        {/* Header */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">Movimentações Manuais</h1>
              {user && (
                <TransactionForm
                  isOpen={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  onSuccess={fetchTransactions}
                  units={units}
                  accounts={accounts}
                  categories={categories}
                  partners={partners}
                  isAdmin={isAdmin}
                  userUnit={userUnit}
                  user={user}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Registre aqui movimentações que <strong>não passam pelo LIS</strong>: reembolsos a pacientes, 
              ajustes de caixa, sangrias, depósitos manuais, correções, etc.
            </p>
          </div>
          
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Atenção:</strong> Os recebimentos de atendimentos (dinheiro, PIX, cartão) 
              são importados automaticamente do LIS na Central de Fechamento. 
              Use esta página apenas para movimentações extras.
            </AlertDescription>
          </Alert>
        </div>

        {/* Filters for Admin */}
        {isAdmin && (
          <TransactionFilters
            filterUnitId={filterUnitId}
            onFilterChange={setFilterUnitId}
          />
        )}

        {/* Transactions Table */}
        <TransactionTable
          transactions={transactions}
          isAdmin={isAdmin}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDocument={viewDocument}
        />

        {/* Document Preview Dialog */}
        <DocumentPreviewDialog
          selectedDocument={selectedDocument}
          documentPreviewUrl={documentPreviewUrl}
          onClose={closeDocumentPreview}
        />
      </div>
    </AppLayout>
  );
}
