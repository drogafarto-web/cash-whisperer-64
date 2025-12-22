import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Target, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface FatorREducationalCardProps {
  fatorRAtual?: number;
  anexoAtual?: 'III' | 'V';
}

export function FatorREducationalCard({ fatorRAtual, anexoAtual }: FatorREducationalCardProps) {
  return (
    <Card className="border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 via-blue-500/10 to-indigo-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Entenda o Fator R para Laboratórios
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>O Fator R determina se seu laboratório de análises clínicas fica no Anexo III (mais barato) ou Anexo V (mais caro) do Simples Nacional.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Regra de enquadramento do Simples Nacional para serviços de saúde
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabela de Enquadramento */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Fator R</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead>Alíquota Inicial</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className={anexoAtual === 'III' ? 'bg-green-500/10' : ''}>
                <TableCell className="font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="underline decoration-dotted cursor-help">
                        ≥ 28%
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Folha de pagamento 12m ÷ Receita bruta 12m ≥ 28%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <Badge variant="default" className="bg-green-600">
                    III
                  </Badge>
                </TableCell>
                <TableCell className="text-green-600 font-medium">~6%</TableCell>
                <TableCell className="text-right">
                  <CheckCircle className="h-4 w-4 text-green-600 inline" />
                  <span className="ml-1 text-xs text-green-600">Mais econômico</span>
                </TableCell>
              </TableRow>
              <TableRow className={anexoAtual === 'V' ? 'bg-red-500/10' : ''}>
                <TableCell className="font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="underline decoration-dotted cursor-help">
                        &lt; 28%
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Folha de pagamento 12m ÷ Receita bruta 12m &lt; 28%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">
                    V
                  </Badge>
                </TableCell>
                <TableCell className="text-red-600 font-medium">~15,5%</TableCell>
                <TableCell className="text-right">
                  <AlertTriangle className="h-4 w-4 text-red-600 inline" />
                  <span className="ml-1 text-xs text-red-600">Mais caro</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Fórmula */}
        <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Fórmula do Fator R
          </p>
          <div className="font-mono text-center py-2 text-lg">
            Fator R = <span className="text-primary font-bold">Folha 12m</span> ÷ <span className="text-primary font-bold">Receita 12m</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Folha inclui: Salários + Pró-labore + INSS Patronal + FGTS
          </p>
        </div>

        {/* Meta */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700">
                Alvo: Manter Fator R ≥ 28%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                A principal estratégia é ajustar o pró-labore dos sócios para manter a folha 
                acima de 28% da receita, garantindo o Anexo III e economia de até 9% na carga tributária.
              </p>
            </div>
          </div>
        </div>

        {/* Status Atual */}
        {fatorRAtual !== undefined && (
          <div className={`p-3 rounded-lg border ${
            fatorRAtual >= 0.28 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <p className="text-sm">
              <span className="font-medium">Seu Fator R atual: </span>
              <span className={`font-bold ${
                fatorRAtual >= 0.28 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(fatorRAtual * 100).toFixed(1)}%
              </span>
              {fatorRAtual >= 0.28 
                ? ' — Você está no Anexo III ✓'
                : ' — Você está no Anexo V, considere aumentar o pró-labore'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}