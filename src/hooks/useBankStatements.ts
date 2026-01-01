import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { logBankStatementAction } from '@/services/cashAuditService';
import { toast } from 'sonner';

// Contas bancárias conhecidas
export const BANK_ACCOUNTS = [
  { id: 'labclin-bb', name: 'LABCLIN LTDA - Banco do Brasil' },
  { id: 'ton', name: 'Ton - Maquininha' },
  { id: 'bruno-pf', name: 'Bruno de Andrade Pires - Pessoa Física' },
];

export const STORAGE_BUCKET = 'accounting-documents';
export const STORAGE_FOLDER = 'bank-statements';

export interface StoredFile {
  name: string;
  id: string;
  created_at: string;
  accountId?: string;
  accountName?: string;
  metadata?: { size?: number };
}

interface UseBankStatementsOptions {
  userId: string;
}

export function useBankStatements({ userId }: UseBankStatementsOptions) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const allFiles: StoredFile[] = [];
      
      // Listar arquivos de cada conta
      for (const account of BANK_ACCOUNTS) {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .list(`${STORAGE_FOLDER}/${account.id}`, {
            limit: 50,
            sortBy: { column: 'created_at', order: 'desc' },
          });
        
        if (!error && data) {
          allFiles.push(
            ...data
              .filter(f => !f.name.startsWith('.'))
              .map(f => ({
                ...f,
                id: `${account.id}/${f.name}`,
                accountId: account.id,
                accountName: account.name,
              }))
          );
        }
      }
      
      setFiles(allFiles);
      return allFiles;
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadFile = useCallback(async (accountId: string, file: File) => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${format(new Date(), 'yyyy-MM-dd_HH-mm')}.${ext}`;
      const path = `${STORAGE_FOLDER}/${accountId}/${fileName}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });

      if (error) throw error;

      // Log da ação
      await logBankStatementAction({
        userId,
        action: 'uploaded',
        fileName,
        accountName: BANK_ACCOUNTS.find(a => a.id === accountId)?.name,
      });

      toast.success('Extrato arquivado com sucesso');
      await loadFiles();
      return true;
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [userId, loadFiles]);

  const getSignedUrl = useCallback(async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(`${STORAGE_FOLDER}/${filePath}`, 3600); // 1 hora

      if (error) throw error;

      // Log da visualização
      await logBankStatementAction({
        userId,
        action: 'viewed',
        fileName: filePath.split('/').pop(),
      });

      return data.signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL:', error);
      toast.error('Erro ao abrir arquivo');
      return null;
    }
  }, [userId]);

  const deleteFile = useCallback(async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([`${STORAGE_FOLDER}/${filePath}`]);

      if (error) throw error;

      toast.success('Arquivo excluído');
      await loadFiles();
      return true;
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      toast.error('Erro ao excluir arquivo');
      return false;
    }
  }, [loadFiles]);

  // Agrupar arquivos por conta
  const groupedFiles = BANK_ACCOUNTS.map(account => ({
    ...account,
    files: files.filter(f => f.id.startsWith(account.id)),
  }));

  // Verificar se há extratos do mês anterior
  const checkMissingStatements = useCallback((targetMonth?: Date) => {
    const checkDate = targetMonth || new Date();
    const prevMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() - 1, 1);
    const monthPrefix = format(prevMonth, 'yyyy-MM');
    
    const accountsWithMissing = BANK_ACCOUNTS.filter(account => {
      const accountFiles = files.filter(f => f.id.startsWith(account.id));
      const hasMonthFile = accountFiles.some(f => f.name.startsWith(monthPrefix));
      return !hasMonthFile;
    });
    
    return {
      hasMissing: accountsWithMissing.length > 0,
      missingAccounts: accountsWithMissing,
      targetMonth: format(prevMonth, 'MMMM/yyyy'),
    };
  }, [files]);

  return {
    files,
    groupedFiles,
    isLoading,
    isUploading,
    loadFiles,
    uploadFile,
    getSignedUrl,
    deleteFile,
    checkMissingStatements,
    BANK_ACCOUNTS,
  };
}
