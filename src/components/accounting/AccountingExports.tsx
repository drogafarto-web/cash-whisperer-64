import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileSpreadsheet, 
  FileText, 
  Database, 
  ArrowLeft, 
  Download,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AccountingExportsProps {
  competence: Date;
  onBack: () => void;
}

type ExportStatus = 'idle' | 'loading' | 'success';

export function AccountingExports({ competence, onBack }: AccountingExportsProps) {
  const [exportStatus, setExportStatus] = useState<Record<string, ExportStatus>>({
    dominio: 'idle',
    excel: 'idle',
    pdf: 'idle',
  });

  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });

  const handleExport = async (type: 'dominio' | 'excel' | 'pdf') => {
    setExportStatus(prev => ({ ...prev, [type]: 'loading' }));
    
    // Simular exportação (no futuro, chamar APIs reais)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setExportStatus(prev => ({ ...prev, [type]: 'success' }));
    
    const labels = {
      dominio: 'Arquivo Domínio',
      excel: 'Planilha Excel',
      pdf: 'Relatório PDF',
    };
    
    toast.success(`${labels[type]} gerado com sucesso!`, {
      description: `Competência: ${competenceLabel}`,
    });
    
    // Reset após 3 segundos
    setTimeout(() => {
      setExportStatus(prev => ({ ...prev, [type]: 'idle' }));
    }, 3000);
  };

  const exports = [
    {
      id: 'dominio',
      icon: Database,
      title: 'Gerar Movimentos para Domínio',
      description: 'Arquivo de integração com sistema Domínio Contábil',
      badge: 'Em breve',
      badgeVariant: 'outline' as const,
      disabled: true,
    },
    {
      id: 'excel',
      icon: FileSpreadsheet,
      title: 'Exportar Transações em Excel',
      description: 'Planilha com todas as transações do período',
      badge: null,
      disabled: false,
    },
    {
      id: 'pdf',
      icon: FileText,
      title: 'Exportar Resumo em PDF',
      description: 'Relatório consolidado para análise contábil',
      badge: null,
      disabled: false,
    },
  ];

  const getButtonContent = (id: string, disabled: boolean) => {
    const status = exportStatus[id];
    
    if (status === 'loading') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando...
        </>
      );
    }
    
    if (status === 'success') {
      return (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Gerado!
        </>
      );
    }
    
    if (disabled) {
      return 'Em desenvolvimento';
    }
    
    return (
      <>
        <Download className="h-4 w-4" />
        Gerar Arquivo
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Botão voltar */}
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Painel
      </Button>

      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Exportar para Contabilidade</h2>
        <p className="text-muted-foreground">
          Competência: <span className="font-medium capitalize">{competenceLabel}</span>
        </p>
      </div>

      {/* Cards de exportação */}
      <div className="grid gap-4 max-w-2xl mx-auto">
        {exports.map((exp) => (
          <Card key={exp.id} className={exp.disabled ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <exp.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{exp.title}</CardTitle>
                    <CardDescription className="text-sm">{exp.description}</CardDescription>
                  </div>
                </div>
                {exp.badge && (
                  <Badge variant={exp.badgeVariant}>{exp.badge}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                className="w-full gap-2"
                variant={exportStatus[exp.id] === 'success' ? 'outline' : 'default'}
                disabled={exp.disabled || exportStatus[exp.id] === 'loading'}
                onClick={() => handleExport(exp.id as 'dominio' | 'excel' | 'pdf')}
              >
                {getButtonContent(exp.id, exp.disabled)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
