import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, FileText, Receipt, ArrowRight } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface CompetenceCardProps {
  selectedUnit: string;
  dateRange: { start: Date; end: Date };
}

export function CompetenceCard({ selectedUnit, dateRange }: CompetenceCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['competence-dre', selectedUnit, dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');
      
      // Faturamento: NFs emitidas no período (por issue_date, não por pagamento)
      let invoicesQuery = supabase
        .from('invoices')
        .select('net_value, issue_date')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate);
      
      if (selectedUnit !== 'all') {
        invoicesQuery = invoicesQuery.eq('unit_id', selectedUnit);
      }
      
      const { data: invoices } = await invoicesQuery;
      
      // Despesas Assumidas: payables criados no período (independente de pagamento)
      let payablesQuery = supabase
        .from('payables')
        .select('valor, created_at')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);
      
      if (selectedUnit !== 'all') {
        payablesQuery = payablesQuery.eq('unit_id', selectedUnit);
      }
      
      const { data: payables } = await payablesQuery;
      
      const faturamento = invoices?.reduce((sum, inv) => sum + Number(inv.net_value || 0), 0) || 0;
      const despesas = payables?.reduce((sum, pay) => sum + Number(pay.valor || 0), 0) || 0;
      const resultado = faturamento - despesas;
      const margem = faturamento > 0 ? (resultado / faturamento) * 100 : 0;
      
      return {
        faturamento,
        despesas,
        resultado,
        margem,
        nfsCount: invoices?.length || 0,
        payablesCount: payables?.length || 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const periodoLabel = `${format(dateRange.start, 'MMM', { locale: ptBR })} - ${format(dateRange.end, 'MMM yyyy', { locale: ptBR })}`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = (data?.resultado || 0) >= 0;
  const margemLevel = (data?.margem || 0) >= 15 ? 'success' : (data?.margem || 0) >= 10 ? 'warning' : 'error';

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-medium">DRE Competência</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Visão por regime de competência: considera NFs emitidas e despesas assumidas, independentemente do pagamento.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="secondary" className="text-xs">
            {periodoLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Receitas emitidas × Despesas assumidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Resultado Principal */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Resultado Operacional</p>
            <p className={cn(
              "text-2xl font-bold",
              isPositive ? "text-green-600" : "text-destructive"
            )}>
              {isPositive ? '+' : ''}{formatCurrency(data?.resultado || 0)}
            </p>
          </div>
          <div className={cn(
            "p-2 rounded-full",
            isPositive ? "bg-green-100" : "bg-red-100"
          )}>
            {isPositive ? (
              <TrendingUp className={cn("h-5 w-5", isPositive ? "text-green-600" : "text-destructive")} />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
          </div>
        </div>

        {/* Linhas do DRE */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-3 w-3" />
              Faturamento ({data?.nfsCount} NFs)
            </span>
            <span className="font-medium text-green-600">
              +{formatCurrency(data?.faturamento || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Receipt className="h-3 w-3" />
              Despesas ({data?.payablesCount} docs)
            </span>
            <span className="font-medium text-destructive">
              -{formatCurrency(data?.despesas || 0)}
            </span>
          </div>
        </div>

        {/* Margem */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">Margem Líquida</span>
          <Badge variant={margemLevel === 'success' ? 'default' : margemLevel === 'warning' ? 'secondary' : 'destructive'}>
            {(data?.margem || 0).toFixed(1)}%
          </Badge>
        </div>

        {/* Link */}
        <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
          <Link to="/reports/transactions">
            Ver transações <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
