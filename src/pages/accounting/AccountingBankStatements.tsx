import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Eye, Loader2, FolderOpen, ShieldCheck } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/auth/RequireRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAuth } from '@/hooks/useAuth';
import { useBankStatements } from '@/hooks/useBankStatements';

export default function AccountingBankStatements() {
  const { user } = useAuth();
  const userId = user?.id || '';
  
  const {
    groupedFiles,
    isLoading,
    loadFiles,
    getSignedUrl,
  } = useBankStatements({ userId });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleView = async (filePath: string) => {
    const url = await getSignedUrl(filePath);
    if (url) {
      setPreviewUrl(url);
      setShowPreview(true);
    }
  };

  return (
    <RequireRole roles={['contador', 'admin']}>
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">Extratos Bancários</h1>
            <p className="text-muted-foreground">
              Visualização dos extratos arquivados pelo laboratório
            </p>
          </div>

          {/* Info */}
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Esta página é apenas para visualização. O upload de novos extratos é gerenciado internamente.
            </AlertDescription>
          </Alert>

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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleView(file.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
      </AppLayout>
    </RequireRole>
  );
}
