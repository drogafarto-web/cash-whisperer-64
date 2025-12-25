import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, 
  History, Eye, AlertTriangle, FileCheck 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  importConvenioReportsZip, 
  previewConvenioReportsZip,
  ConvenioImportResult 
} from '@/utils/convenioReportImport';
import { 
  useSaveConvenioImport, 
  useConvenioImportSessions, 
  useExistingLisCodes,
  useSessionDetails 
} from '@/features/audit';
import { useAuth } from '@/hooks/useAuth';
import { UnitSelector } from '@/components/UnitSelector';

interface DuplicateAnalysis {
  newCodes: string[];
  duplicateCodes: string[];
  totalNew: number;
  totalDuplicate: number;
}

export default function ConvenioReportsImport() {
  const { user, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unit?.id || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ xlsFiles: string[]; pdfFiles: string[]; otherFiles: string[] } | null>(null);
  const [importResult, setImportResult] = useState<ConvenioImportResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { mutate: saveImport, isPending: isSaving } = useSaveConvenioImport();
  const { data: sessions } = useConvenioImportSessions(selectedUnitId || undefined);
  const { data: existingLisCodes } = useExistingLisCodes(selectedUnitId);
  const { data: sessionDetails, isLoading: isLoadingDetails } = useSessionDetails(selectedSessionId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);
    setDuplicateAnalysis(null);
    setParseProgress(0);

    // Preview rápido
    const previewData = await previewConvenioReportsZip(file);
    setPreview(previewData);
  };

  const handleParse = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    setParseProgress(10);

    try {
      const result = await importConvenioReportsZip(selectedFile);
      setParseProgress(70);
      setImportResult(result);

      // Análise de duplicados
      if (existingLisCodes) {
        const allCodes = result.files.flatMap(f => f.rows.map(r => r.lis_code));
        const newCodes = allCodes.filter(code => !existingLisCodes.has(code));
        const duplicateCodes = allCodes.filter(code => existingLisCodes.has(code));
        
        setDuplicateAnalysis({
          newCodes,
          duplicateCodes,
          totalNew: newCodes.length,
          totalDuplicate: duplicateCodes.length,
        });
      }
      
      setParseProgress(100);
    } catch (error) {
      console.error('Error parsing ZIP:', error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = () => {
    if (!importResult || !user) return;

    saveImport({
      importResult,
      unitId: selectedUnitId,
      userId: user.id,
      fileName: selectedFile?.name || 'unknown.zip',
    }, {
      onSuccess: () => {
        setSelectedFile(null);
        setPreview(null);
        setImportResult(null);
        setDuplicateAnalysis(null);
        setParseProgress(0);
      },
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const canImport = duplicateAnalysis ? duplicateAnalysis.totalNew > 0 : true;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Importar Relatórios por Convênio</h1>
            <p className="text-muted-foreground">
              Importe o ZIP com relatórios XLS gerados pelo LIS
            </p>
          </div>
          <UnitSelector value={selectedUnitId} onChange={setSelectedUnitId} />
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Arquivo ZIP
            </CardTitle>
            <CardDescription>
              Selecione o arquivo ZIP contendo os relatórios por convênio (XLS)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="max-w-md"
              />
              {selectedFile && preview && !importResult && (
                <Button onClick={handleParse} disabled={isParsing}>
                  {isParsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Analisar Arquivos'
                  )}
                </Button>
              )}
            </div>

            {isParsing && (
              <div className="space-y-2">
                <Progress value={parseProgress} />
                <p className="text-sm text-muted-foreground">
                  Analisando arquivos XLS...
                </p>
              </div>
            )}

            {/* Preview */}
            {preview && !importResult && (
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Conteúdo do ZIP</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Arquivos XLS</p>
                    <p className="text-lg font-bold text-primary">{preview.xlsFiles.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Arquivos PDF</p>
                    <p className="text-lg font-bold text-muted-foreground">{preview.pdfFiles.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outros</p>
                    <p className="text-lg font-bold text-muted-foreground">{preview.otherFiles.length}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Apenas os arquivos XLS serão processados
                </p>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="space-y-4">
                {/* Duplicate Analysis Alert */}
                {duplicateAnalysis && (
                  <div className={`rounded-lg border p-4 ${
                    duplicateAnalysis.totalNew === 0 
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' 
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {duplicateAnalysis.totalNew === 0 ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      ) : (
                        <FileCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium mb-2">Análise de Duplicados</h4>
                        <div className="flex gap-6">
                          <div>
                            <span className="text-2xl font-bold text-emerald-600">{duplicateAnalysis.totalNew}</span>
                            <span className="text-sm text-muted-foreground ml-2">registros novos</span>
                          </div>
                          <div>
                            <span className="text-2xl font-bold text-amber-600">{duplicateAnalysis.totalDuplicate}</span>
                            <span className="text-sm text-muted-foreground ml-2">já importados (serão ignorados)</span>
                          </div>
                        </div>
                        {duplicateAnalysis.totalNew === 0 && (
                          <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                            Todos os registros deste arquivo já foram importados anteriormente.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/50 p-4">
                  <h4 className="font-medium mb-3">Resultado da Análise</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Convênios/Particulares</p>
                      <p className="text-lg font-bold">{importResult.providers_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Registros</p>
                      <p className="text-lg font-bold">{importResult.total_records}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Período Início</p>
                      <p className="text-lg font-bold">
                        {importResult.period_start 
                          ? format(importResult.period_start, 'dd/MM/yyyy')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Período Fim</p>
                      <p className="text-lg font-bold">
                        {importResult.period_end 
                          ? format(importResult.period_end, 'dd/MM/yyyy')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Files breakdown */}
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Registros</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.files.map((file, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-green-600" />
                              {file.filename}
                            </div>
                          </TableCell>
                          <TableCell>{file.provider_name}</TableCell>
                          <TableCell>
                            <Badge variant={file.is_particular ? 'default' : 'secondary'}>
                              {file.is_particular ? 'Particular' : 'Convênio'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{file.rows.length}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(file.rows.reduce((sum, r) => sum + r.amount, 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      setImportResult(null);
                      setDuplicateAnalysis(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={isSaving || !canImport}
                    size="lg"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar Importação
                        {duplicateAnalysis && ` (${duplicateAnalysis.totalNew} novos)`}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import History - Always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Importações
            </CardTitle>
            <CardDescription>
              Visualize todas as importações realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions && sessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Convênios</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{session.file_name}</TableCell>
                      <TableCell>
                        {session.period_start && session.period_end
                          ? `${format(new Date(session.period_start), 'dd/MM/yyyy')} - ${format(new Date(session.period_end), 'dd/MM/yyyy')}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">{session.providers_count}</TableCell>
                      <TableCell className="text-right">{session.total_records}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSessionId(session.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma importação realizada ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Details Modal */}
      <Dialog open={!!selectedSessionId} onOpenChange={(open) => !open && setSelectedSessionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Importação</DialogTitle>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : sessionDetails ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground mb-1">Valor Total Importado</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(sessionDetails.total_amount)}
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convênio/Particular</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionDetails.providers.map((provider, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{provider.provider_name}</TableCell>
                      <TableCell>
                        <Badge variant={provider.is_particular ? 'default' : 'secondary'}>
                          {provider.is_particular ? 'Particular' : 'Convênio'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{provider.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(provider.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
