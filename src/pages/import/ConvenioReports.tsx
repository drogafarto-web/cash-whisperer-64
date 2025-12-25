import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  importConvenioReportsZip, 
  previewConvenioReportsZip,
  ConvenioImportResult 
} from '@/utils/convenioReportImport';
import { useSaveConvenioImport, useConvenioImportSessions } from '@/features/audit';
import { useAuth } from '@/hooks/useAuth';
import { UnitSelector } from '@/components/UnitSelector';

export default function ConvenioReportsImport() {
  const { user, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unit?.id || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ xlsFiles: string[]; pdfFiles: string[]; otherFiles: string[] } | null>(null);
  const [importResult, setImportResult] = useState<ConvenioImportResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);

  const { mutate: saveImport, isPending: isSaving } = useSaveConvenioImport();
  const { data: sessions } = useConvenioImportSessions(selectedUnitId || undefined);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);
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
      setParseProgress(100);
      setImportResult(result);
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

                <div className="flex justify-end">
                  <Button 
                    onClick={handleImport} 
                    disabled={isSaving}
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
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import History */}
        {sessions && sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Importações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Convênios</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{session.file_name}</TableCell>
                      <TableCell>
                        {session.period_start && session.period_end
                          ? `${format(new Date(session.period_start), 'dd/MM/yyyy')} - ${format(new Date(session.period_end), 'dd/MM/yyyy')}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">{session.providers_count}</TableCell>
                      <TableCell className="text-right">{session.total_records}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
