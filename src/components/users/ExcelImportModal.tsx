import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileSpreadsheet, 
  Upload, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Users,
  UserPlus,
  RefreshCw,
  Building2,
  Shield,
} from 'lucide-react';
import {
  parseExcelFile,
  consolidateDuplicates,
  prepareImportPreview,
  formatCpf,
  type ConsolidatedUser,
  type ImportPreview,
} from '@/services/excelUserImport';

interface ExcelImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ExcelImportModal({ open, onOpenChange, onSuccess }: ExcelImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }
    
    setFile(selectedFile);
    setIsLoading(true);
    
    try {
      // Parse Excel
      const parsedUsers = await parseExcelFile(selectedFile);
      const consolidatedUsers = consolidateDuplicates(parsedUsers);
      
      // Buscar emails e CPFs existentes
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('email, cpf');
      
      const existingEmails = (existingProfiles || []).map(p => p.email).filter(Boolean);
      const existingCpfs = (existingProfiles || []).map(p => p.cpf).filter(Boolean) as string[];
      
      const importPreview = prepareImportPreview(consolidatedUsers, existingEmails, existingCpfs);
      setPreview(importPreview);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Erro ao processar arquivo Excel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    
    setStep('importing');
    setImportProgress({ current: 0, total: preview.totalUsers });
    
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    for (let i = 0; i < preview.validationResults.length; i++) {
      const { user, status } = preview.validationResults[i];
      
      if (status === 'error') {
        results.failed++;
        results.errors.push(`${user.name}: Dados inválidos`);
        setImportProgress({ current: i + 1, total: preview.totalUsers });
        continue;
      }
      
      try {
        const { error } = await supabase.functions.invoke('bulk-create-users', {
          body: {
            users: [user],
          },
        });
        
        if (error) {
          results.failed++;
          results.errors.push(`${user.name}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${user.name}: ${error.message || 'Erro desconhecido'}`);
      }
      
      setImportProgress({ current: i + 1, total: preview.totalUsers });
    }
    
    setImportResults(results);
    setStep('complete');
    
    if (results.success > 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setImportResults({ success: 0, failed: 0, errors: [] });
    onOpenChange(false);
  };

  const getStatusBadge = (status: 'valid' | 'warning' | 'error') => {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="bg-green-500">Válido</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-amber-500 text-white">Atenção</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Admin',
      gestor_unidade: 'Gestor',
      secretaria: 'Secretaria',
      financeiro: 'Financeiro',
      contador: 'Contador',
    };
    return <Badge variant="outline">{roleLabels[role] || role}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Usuários via Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Arraste um arquivo .xlsx ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use a planilha de colaboradores com as colunas: CPF, Nome Completo, E-mail, unidade, ID do Grupo
                  </p>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="max-w-xs"
                  />
                </>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{preview.totalUsers}</p>
                    <p className="text-sm text-muted-foreground">Total de usuários</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg">
                  <UserPlus className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">{preview.newUsers}</p>
                    <p className="text-sm text-muted-foreground">Novos usuários</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-lg">
                  <RefreshCw className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{preview.updateUsers}</p>
                    <p className="text-sm text-muted-foreground">Atualizações</p>
                  </div>
                </div>
              </div>

              {/* Special cases alerts */}
              {preview.specialCases.duplicateCpfs.length > 0 && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-700 dark:text-amber-400">
                    {preview.specialCases.duplicateCpfs.length} CPF(s) duplicado(s)
                  </AlertTitle>
                  <AlertDescription className="text-amber-600 dark:text-amber-300">
                    {preview.specialCases.duplicateCpfs.map(u => (
                      <span key={u.email} className="block">
                        <strong>{u.name}</strong> ({formatCpf(u.cpf)}) → {u.unitNames.join(' + ')}
                      </span>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {preview.specialCases.cnpjUsers.length > 0 && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <AlertTitle className="text-blue-700 dark:text-blue-400">
                    {preview.specialCases.cnpjUsers.length} usuário(s) com CNPJ
                  </AlertTitle>
                  <AlertDescription className="text-blue-600 dark:text-blue-300">
                    {preview.specialCases.cnpjUsers.map(u => u.name).join(', ')} - Serão tratados como pessoa jurídica
                  </AlertDescription>
                </Alert>
              )}

              {preview.specialCases.noCpfUsers.length > 0 && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <Shield className="h-4 w-4 text-red-500" />
                  <AlertTitle className="text-red-700 dark:text-red-400">
                    {preview.specialCases.noCpfUsers.length} usuário(s) sem CPF
                  </AlertTitle>
                  <AlertDescription className="text-red-600 dark:text-red-300">
                    {preview.specialCases.noCpfUsers.map(u => u.name).join(', ')} - CPF pendente para atualização
                  </AlertDescription>
                </Alert>
              )}

              {/* Users table */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Unidade(s)</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.validationResults.map(({ user, status, warnings }) => (
                      <TableRow key={user.email}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-sm font-mono">
                          {user.cpf ? formatCpf(user.cpf) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.unitNames.length > 0 ? (
                              user.unitNames.map(unit => (
                                <Badge key={unit} variant="outline" className="text-xs">
                                  {unit}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(status)}
                            {warnings.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {warnings[0]}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Importando usuários...</p>
              <p className="text-sm text-muted-foreground">
                {importProgress.current} de {importProgress.total} processados
              </p>
              <div className="w-full max-w-md h-2 bg-muted rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-center gap-4 py-8">
                {importResults.success > 0 ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                ) : (
                  <XCircle className="h-16 w-16 text-red-500" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                  <p className="text-sm text-muted-foreground">Importados</p>
                </div>
                <div className="text-center p-4 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <ScrollArea className="h-32 border rounded-lg p-2">
                  <div className="space-y-1">
                    {importResults.errors.map((error, i) => (
                      <p key={i} className="text-sm text-red-600">{error}</p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setPreview(null); }}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={preview?.validationResults.every(r => r.status === 'error')}>
                <Upload className="w-4 h-4 mr-2" />
                Executar Importação ({preview?.totalUsers})
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
