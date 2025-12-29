import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useCompetenceDocuments } from '@/hooks/useAccountingCompetence';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaxSummaryCardProps {
  unitId: string;
  ano: number;
  mes: number;
}

interface TaxCategory {
  key: string;
  label: string;
  color: string;
  total: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  das: { label: 'DAS', color: 'bg-blue-500' },
  darf: { label: 'DARF', color: 'bg-purple-500' },
  gps: { label: 'GPS', color: 'bg-orange-500' },
  inss: { label: 'INSS', color: 'bg-green-500' },
  fgts: { label: 'FGTS', color: 'bg-cyan-500' },
  iss: { label: 'ISS', color: 'bg-yellow-500' },
};

export function TaxSummaryCard({ unitId, ano, mes }: TaxSummaryCardProps) {
  const { data: documents, isLoading } = useCompetenceDocuments(unitId, ano, mes);

  const { categories, total } = useMemo(() => {
    if (!documents?.length) {
      return { categories: [], total: 0 };
    }

    // Group by category and sum values from OCR data
    const categoryTotals: Record<string, number> = {};
    
    documents.forEach(doc => {
      if (doc.ocr_status !== 'processado') return;
      
      const ocrData = doc.ocr_data as Record<string, unknown> | null;
      const valor = ocrData?.valor as number | null;
      
      if (valor && valor > 0) {
        const cat = doc.categoria;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + valor;
      }
    });

    const cats: TaxCategory[] = Object.entries(categoryTotals)
      .filter(([key]) => CATEGORY_CONFIG[key])
      .map(([key, total]) => ({
        key,
        label: CATEGORY_CONFIG[key].label,
        color: CATEGORY_CONFIG[key].color,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const totalSum = cats.reduce((sum, c) => sum + c.total, 0);

    return { categories: cats, total: totalSum };
  }, [documents]);

  const monthLabel = format(new Date(ano, mes - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo da Competência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded"></div>
              <div className="h-6 bg-muted rounded w-4/5"></div>
              <div className="h-6 bg-muted rounded w-3/5"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo da Competência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum documento processado com valores extraídos para {monthLabel}.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Faça upload de documentos fiscais para ver o resumo automático.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Resumo da Competência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
          <p className="text-2xl font-bold text-primary">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total de impostos extraídos via OCR
          </p>
        </div>

        <div className="space-y-3">
          {categories.map((cat) => {
            const percentage = total > 0 ? (cat.total / total) * 100 : 0;
            return (
              <div key={cat.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-medium">
                      {cat.label}
                    </Badge>
                    <span className="text-sm font-medium">
                      R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {categories.length} categoria(s) com documentos processados
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
