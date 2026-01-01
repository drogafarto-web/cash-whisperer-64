import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Upload, FileText, Eye, Loader2, FolderOpen, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { logBankStatementAction } from '@/services/cashAuditService';
import { formatCurrency } from '@/lib/formats';

// Contas bancárias conhecidas
const BANK_ACCOUNTS = [
  { id: 'labclin-bb', name: 'LABCLIN LTDA - Banco do Brasil' },
  { id: 'ton', name: 'Ton - Maquininha' },
  { id: 'bruno-pf', name: 'Bruno de Andrade Pires - Pessoa Física' },
];

const STORAGE_BUCKET = 'accounting-documents';
const STORAGE_FOLDER = 'bank-statements';

interface StoredFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number };
}

interface BankStatementsTabProps {
  userId: string;
}

export function BankStatementsTab({ userId }: BankStatementsTabProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Carregar arquivos existentes
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
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
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAccount) {
      toast.error('Selecione uma conta bancária primeiro');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${format(new Date(), 'yyyy-MM-dd_HH-mm')}.${ext}`;
      const path = `${STORAGE_FOLDER}/${selectedAccount}/${fileName}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });

      if (error) throw error;

      // Log da ação
      await logBankStatementAction({
        userId,
        action: 'uploaded',
        fileName,
        accountName: BANK_ACCOUNTS.find(a => a.id === selectedAccount)?.name,
      });

      toast.success('Extrato arquivado com sucesso');
      loadFiles();
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleView = async (filePath: string) => {
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

      setPreviewUrl(data.signedUrl);
      setSelectedFile(filePath);
      setShowPreview(true);
    } catch (error) {
      console.error('Erro ao visualizar arquivo:', error);
      toast.error('Erro ao abrir arquivo');
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([`${STORAGE_FOLDER}/${filePath}`]);

      if (error) throw error;

      toast.success('Arquivo excluído');
      loadFiles();
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      toast.error('Erro ao excluir arquivo');
    }
  };

  const groupedFiles = BANK_ACCOUNTS.map(account => ({
    ...account,
    files: files.filter(f => f.id.startsWith(account.id)),
  }));

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Arquivar Extrato Bancário</CardTitle>
          <CardDescription>
            PDFs e planilhas ficam armazenados de forma privada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {BANK_ACCOUNTS.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo (PDF/Excel)</Label>
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handleUpload}
                  disabled={isUploading || !selectedAccount}
                  className="hidden"
                  id="bank-statement-upload"
                />
                <label
                  htmlFor="bank-statement-upload"
                  className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isUploading || !selectedAccount
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-primary/50'
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="text-sm">
                    {isUploading ? 'Enviando...' : 'Selecionar arquivo'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de arquivos por conta */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {groupedFiles.map(account => (
            <Card key={account.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  {account.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {account.files.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum extrato arquivado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {account.files.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium">{file.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(file.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(file.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Visualizar Extrato</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[60vh] rounded-lg border"
                title="Preview do extrato"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
