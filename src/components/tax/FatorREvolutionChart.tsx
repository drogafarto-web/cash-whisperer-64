import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Lightbulb } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface FatorRDataPoint {
  mes: string;
  mesLabel: string;
  fatorR: number;
  fatorRPercent: number;
  zona: 'segura' | 'alerta' | 'critica';
  anexo: 'III' | 'V';
  folha12: number;
  rbt12: number;
}

interface FatorREvolutionChartProps {
  monthlyData: Array<{
    mes: string;
    folha12: number;
    rbt12: number;
  }>;
  selectedMonth: string;
}

export function FatorREvolutionChart({ monthlyData, selectedMonth }: FatorREvolutionChartProps) {
  const chartData = useMemo<FatorRDataPoint[]>(() => {
    return monthlyData.map((data) => {
      const fatorR = data.rbt12 > 0 ? data.folha12 / data.rbt12 : 0;
      const fatorRPercent = fatorR * 100;
      
      let zona: 'segura' | 'alerta' | 'critica' = 'segura';
      if (fatorRPercent < 28) zona = 'critica';
      else if (fatorRPercent < 30) zona = 'alerta';
      
      const anexo: 'III' | 'V' = fatorRPercent >= 28 ? 'III' : 'V';
      
      return {
        mes: data.mes,
        mesLabel: format(new Date(data.mes + '-01'), 'MMM/yy', { locale: ptBR }),
        fatorR,
        fatorRPercent,
        zona,
        anexo,
        folha12: data.folha12,
        rbt12: data.rbt12,
      };
    });
  }, [monthlyData]);

  const currentMonth = chartData.find(d => d.mes === selectedMonth);
  const previousMonth = chartData.length >= 2 ? chartData[chartData.length - 2] : null;
  
  const trend = useMemo(() => {
    if (!currentMonth || !previousMonth) return null;
    const diff = currentMonth.fatorRPercent - previousMonth.fatorRPercent;
    return {
      direction: diff >= 0 ? 'up' : 'down',
      value: Math.abs(diff),
    };
  }, [currentMonth, previousMonth]);

  const actionRecommendation = useMemo(() => {
    if (!currentMonth) return null;
    
    if (currentMonth.zona === 'critica') {
      const targetFolha = currentMonth.rbt12 * 0.28;
      const aumentoNecessario = targetFolha - currentMonth.folha12;
      const aumentoMensal = aumentoNecessario / 12;
      
      return {
        type: 'critico',
        message: `Aumente o pró-labore em ${formatCurrency(aumentoMensal)}/mês para voltar ao Anexo III`,
      };
    }
    
    if (currentMonth.zona === 'alerta') {
      return {
        type: 'alerta',
        message: 'Fator R próximo do limite. Monitore de perto ou considere aumentar levemente o pró-labore.',
      };
    }
    
    return {
      type: 'seguro',
      message: 'Fator R estável acima de 30%. Mantenha a estratégia atual.',
    };
  }, [currentMonth]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload as FatorRDataPoint;
    
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{data.mesLabel}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Fator R:</span>
            <span className={`font-medium ${
              data.zona === 'segura' ? 'text-green-600' :
              data.zona === 'alerta' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {data.fatorRPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Anexo:</span>
            <Badge variant={data.anexo === 'III' ? 'default' : 'destructive'} className="text-xs">
              {data.anexo}
            </Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Folha 12m:</span>
            <span>{formatCurrency(data.folha12)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">RBT12:</span>
            <span>{formatCurrency(data.rbt12)}</span>
          </div>
        </div>
        {data.zona !== 'segura' && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
            {data.zona === 'critica' 
              ? '⚠️ Anexo V - Considere aumentar pró-labore' 
              : '⚡ Zona de alerta - Monitore'}
          </div>
        )}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do Fator R
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Sem dados suficientes para exibir o gráfico de evolução.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução do Fator R (12 Meses)
            </CardTitle>
            <CardDescription>
              Acompanhe a proximidade do limite de 28% e tome ações preventivas
            </CardDescription>
          </div>
          {currentMonth && (
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  currentMonth.zona === 'segura' ? 'text-green-600' :
                  currentMonth.zona === 'alerta' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {currentMonth.fatorRPercent.toFixed(1)}%
                </span>
                {trend && (
                  <span className={`flex items-center text-sm ${
                    trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {trend.direction === 'up' 
                      ? <TrendingUp className="h-4 w-4" />
                      : <TrendingDown className="h-4 w-4" />
                    }
                    {trend.value.toFixed(1)}%
                  </span>
                )}
              </div>
              <Badge variant={currentMonth.anexo === 'III' ? 'default' : 'destructive'}>
                Anexo {currentMonth.anexo}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Zona Segura (≥30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Zona de Alerta (28-30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Zona Crítica (&lt;28%)</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="fatorRGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              
              {/* Reference Areas for colored zones */}
              <ReferenceArea
                y1={30}
                y2={50}
                fill="hsl(142 76% 36%)"
                fillOpacity={0.1}
                label={{ value: '', position: 'insideTopRight' }}
              />
              <ReferenceArea
                y1={28}
                y2={30}
                fill="hsl(45 93% 47%)"
                fillOpacity={0.15}
              />
              <ReferenceArea
                y1={0}
                y2={28}
                fill="hsl(0 84% 60%)"
                fillOpacity={0.1}
              />
              
              <XAxis 
                dataKey="mesLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                domain={[0, 'auto']}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              
              <RechartsTooltip content={<CustomTooltip />} />
              
              {/* Limit lines */}
              <ReferenceLine 
                y={28} 
                stroke="hsl(0 84% 60%)" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ 
                  value: 'Limite 28%', 
                  position: 'right',
                  fill: 'hsl(0 84% 60%)',
                  fontSize: 11,
                }}
              />
              <ReferenceLine 
                y={30} 
                stroke="hsl(45 93% 47%)" 
                strokeWidth={1}
                strokeDasharray="3 3"
                label={{ 
                  value: 'Alerta 30%', 
                  position: 'right',
                  fill: 'hsl(45 93% 47%)',
                  fontSize: 10,
                }}
              />
              
              {/* Main line */}
              <Line
                type="monotone"
                dataKey="fatorRPercent"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = payload.zona === 'segura' 
                    ? 'hsl(142 76% 36%)' 
                    : payload.zona === 'alerta'
                    ? 'hsl(45 93% 47%)'
                    : 'hsl(0 84% 60%)';
                  return (
                    <circle
                      key={payload.mes}
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={color}
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 8, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Action Recommendation */}
        {actionRecommendation && (
          <Alert className={`mt-4 ${
            actionRecommendation.type === 'critico' 
              ? 'border-red-500/50 bg-red-500/5' 
              : actionRecommendation.type === 'alerta'
              ? 'border-yellow-500/50 bg-yellow-500/5'
              : 'border-green-500/50 bg-green-500/5'
          }`}>
            {actionRecommendation.type === 'critico' && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {actionRecommendation.type === 'alerta' && <Target className="h-4 w-4 text-yellow-500" />}
            {actionRecommendation.type === 'seguro' && <Lightbulb className="h-4 w-4 text-green-500" />}
            <AlertDescription className="ml-2">
              {actionRecommendation.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
