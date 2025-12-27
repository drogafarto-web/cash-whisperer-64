import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Info,
  CheckCircle,
  Users,
  HelpCircle,
  FileDown,
  ArrowLeft,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Unit } from '@/types/database';
import {
  runTaxSimulation,
  TaxSimulationOutput,
  MonthlyFinancialData,
  TaxParameters,
  TaxConfig,
  createEmptyMonthlyData,
  DEFAULT_TAX_PARAMETERS,
  DEFAULT_TAX_CONFIG,
  mapTaxGroupToFinancialCategory,
  calculateFolha12,
  calculateRBT12,
  calculateProlaboreAdjustment,
  calculateAnexoSavings,
  ProlaboreAdjustment,
  AnexoSavings,
} from '@/services/taxSimulator';
import {
  simulateRegularization,
  findOptimalRegularization,
  generateRegularizationDiagnostics,
  RegularizationInput,
  RegularizationResult,
} from '@/services/regularizationSimulator';
import { FatorRAlert } from '@/components/alerts/FatorRAlert';
import { FatorREducationalCard } from '@/components/tax/FatorREducationalCard';
import { OptimizationTargetsCard } from '@/components/tax/OptimizationTargetsCard';
import { FatorREvolutionChart } from '@/components/tax/FatorREvolutionChart';
import { AlertPreferencesCard } from '@/components/tax/AlertPreferencesCard';
import { SeedPayroll, SeedRevenue } from '@/hooks/useSeedData';

// Tipo estendido para incluir dados de folha informal
interface ExtendedTaxSimulationOutput extends TaxSimulationOutput {
  folhaOficial12: number;
  folhaInformal12: number;
  custoPessoalTotal: number;
}

export default function TaxScenarios() {
  const navigate = useNavigate();
  const { isAdmin, unit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [regularizationPercent, setRegularizationPercent] = useState<number>(0);

  // Buscar unidades
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Buscar parâmetros tributários
  const { data: taxParameters } = useQuery({
    queryKey: ['tax-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_parameters')
        .select('*')
        .eq('ano', 2025)
        .single();
      
      if (error || !data) return DEFAULT_TAX_PARAMETERS;
      
      return {
        ...data,
        simples_anexo3_faixas: data.simples_anexo3_faixas as unknown as TaxParameters['simples_anexo3_faixas'],
        simples_anexo5_faixas: data.simples_anexo5_faixas as unknown as TaxParameters['simples_anexo5_faixas'],
      } as TaxParameters;
    },
  });

  // Buscar configuração tributária da unidade
  const { data: taxConfig } = useQuery({
    queryKey: ['tax-config', selectedUnitId],
    queryFn: async () => {
      if (selectedUnitId === 'all') return DEFAULT_TAX_CONFIG;
      
      const { data, error } = await supabase
        .from('tax_config')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .single();
      
      if (error || !data) return DEFAULT_TAX_CONFIG;
      
      return {
        regime_atual: data.regime_atual as TaxConfig['regime_atual'],
        iss_aliquota: Number(data.iss_aliquota),
        cnpj: data.cnpj || undefined,
      } as TaxConfig;
    },
    enabled: selectedUnitId !== '',
  });

  // Buscar dados históricos de folha de pagamento (seed_payroll)
  const { data: seedPayroll = [] } = useQuery({
    queryKey: ['seed-payroll-evolution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_payroll')
        .select('*')
        .order('ano', { ascending: true })
        .order('mes', { ascending: true });
      if (error) throw error;
      return data as SeedPayroll[];
    },
  });

  // Buscar dados históricos de receita (seed_revenue)
  const { data: seedRevenue = [] } = useQuery({
    queryKey: ['seed-revenue-evolution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_revenue')
        .select('*')
        .order('ano', { ascending: true })
        .order('mes', { ascending: true });
      if (error) throw error;
      return data as SeedRevenue[];
    },
  });

  // Buscar transações dos últimos 12 meses com categorias
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['tax-transactions', selectedUnitId, selectedMonth],
    queryFn: async () => {
      const endDate = endOfMonth(new Date(selectedMonth + '-01'));
      const startDate = startOfMonth(subMonths(endDate, 11));

      let query = supabase
        .from('transactions')
        .select(`
          *,
          category:categories(id, name, type, tax_group, entra_fator_r, is_informal)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('status', 'APROVADO')
        .is('deleted_at', null);

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedMonth,
  });

  // Processar dados para o simulador
  const simulationResult = useMemo<ExtendedTaxSimulationOutput | null>(() => {
    if (!transactionsData || !taxParameters || !taxConfig) return null;

    // Agrupar transações por mês
    const monthlyDataMap = new Map<string, MonthlyFinancialData>();
    
    // Inicializar os 12 meses
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(selectedMonth + '-01'), 11 - i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyDataMap.set(monthKey, createEmptyMonthlyData(monthKey));
    }

    // Processar transações
    transactionsData.forEach((tx: any) => {
      const monthKey = format(new Date(tx.date), 'yyyy-MM');
      const data = monthlyDataMap.get(monthKey);
      if (!data) return;

      const taxGroup = tx.category?.tax_group;
      const amount = Math.abs(Number(tx.amount));

      if (tx.type === 'ENTRADA') {
        if (taxGroup === 'RECEITA_SERVICOS') {
          data.receita_servicos += amount;
        } else {
          data.receita_outras += amount;
        }
      } else {
        // SAIDA
        switch (taxGroup) {
          case 'PESSOAL':
            // Verificar se é pagamento informal
            const isInformal = tx.category?.is_informal ?? false;
            
            if (isInformal) {
              // Pagamentos informais - NÃO entram no Fator R
              data.folha_informal += amount;
              break;
            }
            
            // Usar flag entra_fator_r para determinar se entra no cálculo
            const entraFatorR = tx.category?.entra_fator_r ?? false;
            
            if (!entraFatorR) {
              // Benefícios e outros que NÃO entram no Fator R
              data.despesas_administrativas += amount;
              break;
            }
            
            // Identificar tipo de despesa de pessoal pelo nome da categoria
            const catName = tx.category?.name?.toLowerCase() || '';
            if (catName.includes('pró-labore') || catName.includes('pro-labore')) {
              data.folha_prolabore += amount;
            } else if (
              catName.includes('inss') || 
              catName.includes('fgts') || 
              catName.includes('encargo') ||
              catName.includes('patronal')
            ) {
              data.folha_encargos += amount;
            } else {
              // Salários, 13º, Férias
              data.folha_salarios += amount;
            }
            break;
          case 'INSUMOS':
            data.insumos += amount;
            break;
          case 'SERVICOS_TERCEIROS':
            data.servicos_terceiros += amount;
            break;
          case 'ADMINISTRATIVAS':
            data.despesas_administrativas += amount;
            break;
          case 'FINANCEIRAS':
            data.despesas_financeiras += amount;
            break;
          case 'TRIBUTARIAS':
            data.impostos_pagos += amount;
            break;
          default:
            data.despesas_administrativas += amount;
        }
      }
    });

    const monthlyDataArray = Array.from(monthlyDataMap.values());
    const currentMonthData = monthlyDataArray.find(m => m.mes === selectedMonth) || createEmptyMonthlyData(selectedMonth);

    // Calcular totais de folha informal dos 12 meses
    const folhaOficial12 = monthlyDataArray.reduce((sum, m) => 
      sum + m.folha_salarios + m.folha_prolabore + m.folha_encargos, 0
    );
    const folhaInformal12 = monthlyDataArray.reduce((sum, m) => sum + m.folha_informal, 0);
    const custoPessoalTotal = folhaOficial12 + folhaInformal12;

    const simulationOutput = runTaxSimulation({
      monthlyData: currentMonthData,
      last12MonthsData: monthlyDataArray,
      taxConfig,
      taxParameters,
    });

    // Adicionar dados de folha informal ao resultado
    return {
      ...simulationOutput,
      folhaOficial12,
      folhaInformal12,
      custoPessoalTotal,
    };
  }, [transactionsData, taxParameters, taxConfig, selectedMonth]);

  // Simulador de Regularização
  const regularizationResult = useMemo<RegularizationResult | null>(() => {
    if (!simulationResult || !taxParameters) return null;
    
    const rbt12 = simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0;
    
    if (rbt12 === 0) return null;
    
    const input: RegularizationInput = {
      folhaOficial12: simulationResult.folhaOficial12,
      pagamentosInformais12: simulationResult.folhaInformal12,
      rbt12,
      taxParameters,
      receitaMensal: simulationResult.receitaTotal,
    };
    
    return simulateRegularization(input, regularizationPercent);
  }, [simulationResult, taxParameters, regularizationPercent]);

  const optimalRegularization = useMemo(() => {
    if (!simulationResult || !taxParameters) return null;
    
    const rbt12 = simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0;
    
    if (rbt12 === 0 || simulationResult.folhaInformal12 === 0) return null;
    
    const input: RegularizationInput = {
      folhaOficial12: simulationResult.folhaOficial12,
      pagamentosInformais12: simulationResult.folhaInformal12,
      rbt12,
      taxParameters,
      receitaMensal: simulationResult.receitaTotal,
    };
    
    return findOptimalRegularization(input);
  }, [simulationResult, taxParameters]);

  const regularizationDiagnostics = useMemo(() => {
    if (!regularizationResult) return [];
    return generateRegularizationDiagnostics(regularizationResult);
  }, [regularizationResult]);

  // Dados para o gráfico de barras
  const barChartData = useMemo(() => {
    if (!simulationResult) return [];
    
    return simulationResult.cenarios.map(c => ({
      name: c.regimeLabel,
      valor: c.total,
      percentual: c.percentualReceita,
    }));
  }, [simulationResult]);

  // Dados para o gráfico de evolução mensal (12 meses)
  const lineChartData = useMemo(() => {
    if (!transactionsData || !taxParameters || !taxConfig) return [];

    // Agrupar transações por mês (mesmo código da simulação)
    const monthlyDataMap = new Map<string, MonthlyFinancialData>();
    
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(selectedMonth + '-01'), 11 - i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyDataMap.set(monthKey, createEmptyMonthlyData(monthKey));
    }

    transactionsData.forEach((tx: any) => {
      const monthKey = format(new Date(tx.date), 'yyyy-MM');
      const data = monthlyDataMap.get(monthKey);
      if (!data) return;

      const taxGroup = tx.category?.tax_group;
      const amount = Math.abs(Number(tx.amount));

      if (tx.type === 'ENTRADA') {
        if (taxGroup === 'RECEITA_SERVICOS') {
          data.receita_servicos += amount;
        } else {
          data.receita_outras += amount;
        }
      } else {
        switch (taxGroup) {
          case 'PESSOAL':
            // Verificar se é pagamento informal
            const isInformalChart = tx.category?.is_informal ?? false;
            
            if (isInformalChart) {
              data.folha_informal += amount;
              break;
            }
            
            const entraFatorRChart = tx.category?.entra_fator_r ?? false;
            
            if (!entraFatorRChart) {
              data.despesas_administrativas += amount;
              break;
            }
            
            const catNameChart = tx.category?.name?.toLowerCase() || '';
            if (catNameChart.includes('pró-labore') || catNameChart.includes('pro-labore')) {
              data.folha_prolabore += amount;
            } else if (
              catNameChart.includes('inss') || 
              catNameChart.includes('fgts') || 
              catNameChart.includes('encargo') ||
              catNameChart.includes('patronal')
            ) {
              data.folha_encargos += amount;
            } else {
              data.folha_salarios += amount;
            }
            break;
          case 'INSUMOS':
            data.insumos += amount;
            break;
          case 'SERVICOS_TERCEIROS':
            data.servicos_terceiros += amount;
            break;
          case 'ADMINISTRATIVAS':
            data.despesas_administrativas += amount;
            break;
          case 'FINANCEIRAS':
            data.despesas_financeiras += amount;
            break;
          case 'TRIBUTARIAS':
            data.impostos_pagos += amount;
            break;
          default:
            data.despesas_administrativas += amount;
        }
      }
    });

    const monthlyDataArray = Array.from(monthlyDataMap.values());

    // Para cada mês, calcular os 4 cenários
    return monthlyDataArray.map((monthData, index) => {
      // Usar dados acumulados até aquele mês para RBT12 correto
      const dataUpToMonth = monthlyDataArray.slice(0, index + 1);
      // Preencher com meses vazios se não tiver 12 meses
      while (dataUpToMonth.length < 12) {
        dataUpToMonth.unshift(createEmptyMonthlyData(''));
      }

      const simulation = runTaxSimulation({
        monthlyData: monthData,
        last12MonthsData: dataUpToMonth.slice(-12),
        taxConfig,
        taxParameters,
      });

      const receita = monthData.receita_servicos + monthData.receita_outras;

      return {
        mes: format(new Date(monthData.mes + '-01'), 'MMM/yy', { locale: ptBR }),
        simples: receita > 0 ? simulation.cenarios.find(c => c.regime === 'SIMPLES')?.percentualReceita || 0 : 0,
        presumido: receita > 0 ? simulation.cenarios.find(c => c.regime === 'PRESUMIDO')?.percentualReceita || 0 : 0,
        real: receita > 0 ? simulation.cenarios.find(c => c.regime === 'REAL')?.percentualReceita || 0 : 0,
        cbsIbs: receita > 0 ? simulation.cenarios.find(c => c.regime === 'CBS_IBS')?.percentualReceita || 0 : 0,
        receita,
      };
    }).filter(d => d.receita > 0);
  }, [transactionsData, taxParameters, taxConfig, selectedMonth]);

  // Calcular dados de evolução do Fator R com janela deslizante de 12 meses
  const fatorREvolutionData = useMemo(() => {
    // Função auxiliar para calcular total de folha de um mês
    const calcFolhaMes = (p: SeedPayroll) => 
      Number(p.salarios || 0) + 
      Number(p.prolabore || 0) + 
      Number(p.inss_patronal || 0) + 
      Number(p.fgts || 0) + 
      Number(p.ferias || 0) + 
      Number(p.decimo_terceiro || 0);

    // Função auxiliar para calcular total de receita de um mês
    const calcReceitaMes = (r: SeedRevenue) => 
      Number(r.receita_servicos || 0) + Number(r.receita_outras || 0);

    // Função para comparar se um mês/ano é <= a outro
    const isMonthBeforeOrEqual = (ano1: number, mes1: number, ano2: number, mes2: number) => {
      if (ano1 < ano2) return true;
      if (ano1 > ano2) return false;
      return mes1 <= mes2;
    };

    // Função para comparar se um mês/ano é > a outro
    const isMonthAfter = (ano1: number, mes1: number, ano2: number, mes2: number) => {
      if (ano1 > ano2) return true;
      if (ano1 < ano2) return false;
      return mes1 > mes2;
    };

    // Calcular 12 meses antes de um mês de referência
    const getMonth12Before = (ano: number, mes: number) => {
      let targetAno = ano - 1;
      let targetMes = mes + 1;
      if (targetMes > 12) {
        targetMes = 1;
        targetAno += 1;
      }
      return { ano: targetAno, mes: targetMes };
    };

    // Gerar array de meses para exibição (últimos 12 meses a partir do mês selecionado)
    const result = [];
    const selectedDate = new Date(selectedMonth + '-01');
    
    for (let i = 11; i >= 0; i--) {
      const targetDate = subMonths(selectedDate, i);
      const targetAno = targetDate.getFullYear();
      const targetMes = targetDate.getMonth() + 1;
      const monthKey = format(targetDate, 'yyyy-MM');
      
      // Calcular o início da janela de 12 meses (11 meses antes + mês atual)
      const windowStart = getMonth12Before(targetAno, targetMes);
      
      // Somar folha dos 12 meses anteriores (incluindo o mês atual)
      const folha12 = seedPayroll
        .filter(p => {
          // Deve ser >= windowStart E <= targetMonth
          const afterStart = isMonthAfter(p.ano, p.mes, windowStart.ano, windowStart.mes) || 
                            (p.ano === windowStart.ano && p.mes === windowStart.mes);
          const beforeEnd = isMonthBeforeOrEqual(p.ano, p.mes, targetAno, targetMes);
          return afterStart && beforeEnd;
        })
        .reduce((sum, p) => sum + calcFolhaMes(p), 0);
      
      // Somar receita dos 12 meses anteriores (incluindo o mês atual)
      const rbt12 = seedRevenue
        .filter(r => {
          const afterStart = isMonthAfter(r.ano, r.mes, windowStart.ano, windowStart.mes) || 
                            (r.ano === windowStart.ano && r.mes === windowStart.mes);
          const beforeEnd = isMonthBeforeOrEqual(r.ano, r.mes, targetAno, targetMes);
          return afterStart && beforeEnd;
        })
        .reduce((sum, r) => sum + calcReceitaMes(r), 0);
      
      result.push({
        mes: monthKey,
        folha12,
        rbt12,
      });
    }
    
    return result;
  }, [seedPayroll, seedRevenue, selectedMonth]);

  // Gerar meses para seleção
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  // Set initial unit
  useEffect(() => {
    if (!isAdmin && unit?.id) {
      setSelectedUnitId(unit.id);
    }
  }, [isAdmin, unit]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Função de exportação PDF
  const exportToPDF = () => {
    if (!simulationResult) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Cenários Tributários', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const selectedUnitName = selectedUnitId === 'all' 
      ? 'Todas as unidades' 
      : units.find(u => u.id === selectedUnitId)?.name || 'Unidade';
    doc.text(`Unidade: ${selectedUnitName} | Período: ${format(new Date(selectedMonth + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, yPos, { align: 'center' });

    // Resumo Fator R
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Fator R', 14, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fator R Atual: ${(simulationResult.fatorR * 100).toFixed(1)}%`, 14, yPos);
    yPos += 5;
    const anexo = simulationResult.fatorR >= 0.28 ? 'Anexo III' : 'Anexo V';
    doc.text(`Anexo Aplicável: ${anexo}`, 14, yPos);
    yPos += 5;
    doc.text(`Receita Total do Mês: ${formatCurrency(simulationResult.receitaTotal)}`, 14, yPos);
    yPos += 5;
    const rbt12 = simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0;
    doc.text(`Receita Bruta 12 meses (RBT12): ${formatCurrency(rbt12)}`, 14, yPos);

    // Tabela de Cenários
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparativo de Regimes Tributários', 14, yPos);
    
    yPos += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    // Header da tabela
    const colWidths = [50, 35, 30, 35, 35];
    const startX = 14;
    doc.text('Regime', startX, yPos);
    doc.text('Imposto', startX + colWidths[0], yPos);
    doc.text('% Receita', startX + colWidths[0] + colWidths[1], yPos);
    doc.text('Diferença', startX + colWidths[0] + colWidths[1] + colWidths[2], yPos);
    doc.text('Status', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos);
    
    yPos += 2;
    doc.line(14, yPos, pageWidth - 14, yPos);
    
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    
    const bestScenario = simulationResult.cenarios.reduce((best, current) => 
      current.total < best.total ? current : best
    );
    
    simulationResult.cenarios.forEach((cenario) => {
      doc.text(cenario.regimeLabel, startX, yPos);
      doc.text(formatCurrency(cenario.total), startX + colWidths[0], yPos);
      doc.text(`${cenario.percentualReceita.toFixed(2)}%`, startX + colWidths[0] + colWidths[1], yPos);
      
      const diff = cenario.total - bestScenario.total;
      doc.text(diff === 0 ? '-' : `+${formatCurrency(diff)}`, startX + colWidths[0] + colWidths[1] + colWidths[2], yPos);
      
      const status = cenario.regime === bestScenario.regime ? 'Mais Vantajoso' : '';
      doc.text(status, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos);
      
      yPos += 6;
    });

    // Diagnósticos
    if (simulationResult.diagnosticos.length > 0) {
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Diagnósticos e Recomendações', 14, yPos);
      
      yPos += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      simulationResult.diagnosticos.slice(0, 5).forEach((diag) => {
        const cleanText = diag.replace(/^[⚠️✅💡📊🔮]\s*/, '');
        const lines = doc.splitTextToSize(cleanText, pageWidth - 28);
        lines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(`• ${line}`, 14, yPos);
          yPos += 5;
        });
      });
    }

    // Rodapé
    yPos = 280;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Nota: Este relatório é uma simulação para fins de planejamento tributário.', 14, yPos);
    yPos += 4;
    doc.text('Consulte um contador para decisões definitivas sobre regime tributário.', 14, yPos);

    // Salvar
    const fileName = `cenarios-tributarios-${selectedMonth}.pdf`;
    doc.save(fileName);
  };

  const getScenarioColor = (regime: string) => {
    switch (regime) {
      case 'SIMPLES': return 'hsl(var(--chart-1))';
      case 'PRESUMIDO': return 'hsl(var(--chart-2))';
      case 'REAL': return 'hsl(var(--chart-3))';
      case 'CBS_IBS': return 'hsl(var(--chart-4))';
      default: return 'hsl(var(--chart-5))';
    }
  };

  const getDiagnosticIcon = (text: string) => {
    if (text.startsWith('⚠️')) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (text.startsWith('✅')) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (text.startsWith('💡')) return <Lightbulb className="h-5 w-5 text-blue-500" />;
    if (text.startsWith('📊')) return <Info className="h-5 w-5 text-purple-500" />;
    if (text.startsWith('🔮')) return <Info className="h-5 w-5 text-indigo-500" />;
    return <Info className="h-5 w-5 text-muted-foreground" />;
  };

  const cleanDiagnosticText = (text: string) => {
    return text.replace(/^[⚠️✅💡📊🔮]\s*/, '');
  };

  // Helper component for Fator R Alert in TaxScenarios
  const FatorRAlertCard = ({ 
    fatorR, 
    rbt12, 
    receitaMensal, 
    taxParameters 
  }: { 
    fatorR: number; 
    rbt12: number; 
    receitaMensal: number; 
    taxParameters: TaxParameters;
  }) => {
    const folha12 = rbt12 * fatorR;
    const adjustment = calculateProlaboreAdjustment(folha12, rbt12);
    const savings = calculateAnexoSavings(receitaMensal, rbt12, taxParameters);

    return (
      <FatorRAlert
        fatorRAtual={adjustment.fatorRAtual}
        ajusteMensal={adjustment.ajusteMensal}
        ajusteAnual={adjustment.ajusteNecessario}
        status={adjustment.status}
        economiaMensal={savings.economiaMensal}
        economiaAnual={savings.economiaAnual}
        aliquotaAnexo3={savings.aliquotaAnexo3}
        aliquotaAnexo5={savings.aliquotaAnexo5}
        showLink={false}
      />
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/accounting-panel')}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Painel
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="h-6 w-6" />
                Cenários Tributários
              </h1>
              <p className="text-muted-foreground">
                Simulação comparativa de regimes fiscais para laboratórios
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && (
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={!simulationResult}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Fator R Badge and Alert with Tooltips */}
        {simulationResult && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={simulationResult.fatorR >= 0.28 ? 'default' : 'destructive'}
                      className="text-sm px-3 py-1 cursor-help"
                    >
                      Fator R: {(simulationResult.fatorR * 100).toFixed(1)}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Fator R = Folha 12m ÷ Receita 12m</p>
                    <p className="text-xs">
                      {simulationResult.fatorR >= 0.28 
                        ? '✓ Acima de 28%, você está no Anexo III com alíquotas menores'
                        : '⚠ Abaixo de 28%, você está no Anexo V com alíquotas maiores. Considere aumentar o pró-labore.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-sm px-3 py-1 cursor-help">
                      Anexo {simulationResult.anexoSimples}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">
                      {simulationResult.anexoSimples === 'III' ? 'Anexo III - Mais Econômico' : 'Anexo V - Mais Caro'}
                    </p>
                    <p className="text-xs">
                      {simulationResult.anexoSimples === 'III' 
                        ? 'Alíquotas iniciais em torno de 6%. Você está aproveitando o benefício do Fator R ≥ 28%.'
                        : 'Alíquotas iniciais em torno de 15,5%. Para migrar ao Anexo III, aumente o Fator R para ≥ 28%.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-sm px-3 py-1 cursor-help">
                      Receita: {formatCurrency(simulationResult.receitaTotal)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Receita bruta do mês selecionado (serviços + outras)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Fator R Alert Card when below threshold */}
            {simulationResult.fatorR < 0.28 && taxParameters && (
              <FatorRAlertCard
                fatorR={simulationResult.fatorR}
                rbt12={simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0}
                receitaMensal={simulationResult.receitaTotal}
                taxParameters={taxParameters}
              />
            )}
          </>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : simulationResult ? (
          <>
            {/* Card Educativo sobre Fator R */}
            <FatorREducationalCard 
              fatorRAtual={simulationResult.fatorR} 
              anexoAtual={simulationResult.anexoSimples} 
            />

            {/* Card de Alvos de Otimização */}
            {taxParameters && (
              <OptimizationTargetsCard
                fatorR={simulationResult.fatorR}
                rbt12={simulationResult.cenarios.find(c => c.regime === 'SIMPLES')?.detalhes.rbt12 || 0}
                folha12={simulationResult.folhaOficial12}
                receitaMensal={simulationResult.receitaTotal}
                taxParameters={taxParameters}
                cenarios={simulationResult.cenarios}
                regimeAtual={taxConfig?.regime_atual || 'SIMPLES'}
              />
            )}

            {/* Gráfico de Evolução do Fator R */}
            <FatorREvolutionChart
              monthlyData={fatorREvolutionData}
              selectedMonth={selectedMonth}
            />

            {/* Card de Preferências de Alertas */}
            <AlertPreferencesCard />

            {/* Bloco de Resumo: Folha Oficial / Informal / Total */}
            {simulationResult.folhaInformal12 > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Custos de Pessoal (12 meses)
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      Atenção
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Comparativo entre folha oficial (Fator R) e pagamentos informais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium text-muted-foreground">Folha Oficial (Fator R)</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(simulationResult.folhaOficial12)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Salários + Pró-labore + Encargos
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        Pagamentos Informais
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(simulationResult.folhaInformal12)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        "Por fora" - não entra no Fator R
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-medium text-muted-foreground">Custo Total Real</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(simulationResult.custoPessoalTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((simulationResult.folhaInformal12 / simulationResult.custoPessoalTotal) * 100).toFixed(1)}% informal
                      </p>
                    </div>
                  </div>
                  <Alert className="mt-4" variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Risco Trabalhista e Fiscal</AlertTitle>
                    <AlertDescription>
                      Pagamentos informais representam risco de passivo trabalhista e fiscal. 
                      Use o <strong>Relatório Real x Oficial</strong> para simular a regularização gradual.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Simulador de Regularização */}
            {simulationResult.folhaInformal12 > 0 && regularizationResult && (
              <Card className="border-blue-500/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Simulador de Regularização de Pagamentos Informais
                  </CardTitle>
                  <CardDescription>
                    Simule o impacto de regularizar os pagamentos "por fora" na folha oficial.
                    Arraste o slider para ver cenários.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Percentual de Regularização
                      </label>
                      <span className="text-lg font-bold text-blue-600">
                        {regularizationPercent}%
                      </span>
                    </div>
                    <Slider
                      value={[regularizationPercent]}
                      onValueChange={(v) => setRegularizationPercent(v[0])}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                    
                    {/* Sugestão de percentual ótimo */}
                    {optimalRegularization && optimalRegularization.percentual > 0 && (
                      <Alert className="mt-2">
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Sugestão:</strong> O percentual ótimo é{' '}
                          <button
                            onClick={() => setRegularizationPercent(optimalRegularization.percentual)}
                            className="text-blue-600 underline font-semibold"
                          >
                            {optimalRegularization.percentual}%
                          </button>
                          {' '}(resultado líquido máximo).
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Cards lado a lado: Atual vs Simulado */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Cenário Atual */}
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <h4 className="font-semibold text-sm mb-3 text-muted-foreground">
                        Cenário Atual (Sem Regularização)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Folha Oficial (12m):</span>
                          <span className="font-medium">
                            {formatCurrency(regularizationResult.folhaOficial)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fator R:</span>
                          <span className={`font-bold ${
                            regularizationResult.fatorRAtual >= 0.28 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(regularizationResult.fatorRAtual * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Anexo Simples:</span>
                          <Badge variant={regularizationResult.anexoAtual === 'III' ? 'default' : 'destructive'}>
                            {regularizationResult.anexoAtual}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Alíquota Efetiva:</span>
                          <span className="font-medium">
                            {formatPercent(regularizationResult.aliquotaAtual * 100)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cenário Simulado */}
                    <div className={`p-4 rounded-lg border ${
                      regularizationPercent > 0 ? 'bg-blue-500/5 border-blue-500/30' : 'bg-muted/30'
                    }`}>
                      <h4 className="font-semibold text-sm mb-3 text-blue-700">
                        Cenário Simulado ({regularizationPercent}% regularizado)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Folha Simulada (12m):</span>
                          <span className="font-medium">
                            {formatCurrency(regularizationResult.folhaSimulada)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fator R Simulado:</span>
                          <span className={`font-bold ${
                            regularizationResult.fatorRSimulado >= 0.28 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(regularizationResult.fatorRSimulado * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Anexo Simples:</span>
                          <Badge variant={regularizationResult.anexoSimulado === 'III' ? 'default' : 'destructive'}>
                            {regularizationResult.anexoSimulado}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Alíquota Efetiva:</span>
                          <span className="font-medium">
                            {formatPercent(regularizationResult.aliquotaSimulada * 100)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card de Impacto Financeiro */}
                  {regularizationPercent > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/20">
                      <h4 className="font-semibold text-sm mb-3">Impacto Financeiro Anual</h4>
                      <div className="grid gap-3 md:grid-cols-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Custo Adicional Encargos</p>
                          <p className="text-lg font-bold text-red-600">
                            {formatCurrency(regularizationResult.custoAdicionalEncargos)}
                          </p>
                          <p className="text-xs text-muted-foreground">~50% sobre valor regularizado</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Economia de Imposto</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(regularizationResult.economiaImposto)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {regularizationResult.anexoAtual !== regularizationResult.anexoSimulado
                              ? 'Migração de anexo!'
                              : 'Mesma alíquota'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Resultado Líquido</p>
                          <p className={`text-lg font-bold ${
                            regularizationResult.resultadoLiquido >= 0 ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {formatCurrency(regularizationResult.resultadoLiquido)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {regularizationResult.resultadoLiquido >= 0 ? 'Vantajoso' : 'Custo adicional'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">ROI / Payback</p>
                          <p className="text-lg font-bold">
                            {regularizationResult.roiRegularizacao >= 0 
                              ? `${(regularizationResult.roiRegularizacao * 100).toFixed(0)}%`
                              : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {regularizationResult.paybackMeses !== Infinity && regularizationResult.paybackMeses > 0
                              ? `Payback: ${regularizationResult.paybackMeses.toFixed(1)} meses`
                              : 'Não aplicável'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista de Diagnósticos */}
                  {regularizationDiagnostics.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Diagnósticos</h4>
                      <ul className="space-y-1 text-sm">
                        {regularizationDiagnostics.map((diag, idx) => (
                          <li key={idx} className="pl-4 border-l-2 border-blue-500 py-1">
                            {diag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Simulação Estimativa</AlertTitle>
                    <AlertDescription>
                      Esta simulação é para <strong>planejamento</strong> de regularização. 
                      Pagamentos informais representam risco trabalhista e fiscal mesmo que o resultado 
                      líquido não seja positivo. <strong>Valide com contador e advogado trabalhista.</strong>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Cards de Cenários */}
            <div className="grid gap-4 md:grid-cols-4">
              {simulationResult.cenarios.map((cenario) => {
                const isBest = cenario.regime === simulationResult.melhorCenario.regime;
                const isCurrentRegime = cenario.regime === taxConfig?.regime_atual;
                const diff = isCurrentRegime ? 0 : cenario.total - (simulationResult.cenarios.find(c => c.regime === taxConfig?.regime_atual)?.total || 0);

                return (
                  <Card
                    key={cenario.regime}
                    className={`relative ${isBest ? 'ring-2 ring-primary' : ''}`}
                  >
                    {isBest && (
                      <Badge className="absolute -top-2 -right-2 text-xs">
                        Melhor opção
                      </Badge>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        {cenario.regimeLabel}
                        {isCurrentRegime && (
                          <Badge variant="outline" className="text-xs">Atual</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(cenario.total)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatPercent(cenario.percentualReceita)} da receita
                      </p>
                      {!isCurrentRegime && diff !== 0 && (
                        <div className={`flex items-center gap-1 text-sm mt-2 ${diff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {diff < 0 ? '-' : '+'}
                          {formatCurrency(Math.abs(diff))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico de Evolução Mensal */}
            {lineChartData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Evolução da Carga Tributária (12 meses)</CardTitle>
                  <CardDescription>
                    Percentual da receita destinado a impostos em cada regime ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={lineChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        className="text-xs"
                        domain={[0, 'auto']}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                        labelFormatter={(label) => `Mês: ${label}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="simples"
                        name="Simples Nacional"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="presumido"
                        name="Lucro Presumido"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="real"
                        name="Lucro Real"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cbsIbs"
                        name="CBS/IBS (Reforma)"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de Barras */}
            <Card>
              <CardHeader>
                <CardTitle>Comparativo de Impostos</CardTitle>
                <CardDescription>
                  Valor total de impostos por regime tributário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v).replace('R$', '')}
                      className="text-xs"
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [formatCurrency(value), 'Imposto']}
                      labelFormatter={(label) => `Regime: ${label}`}
                    />
                    <Bar
                      dataKey="valor"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabela Detalhada */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Regime</CardTitle>
                <CardDescription>
                  Breakdown dos impostos e base de cálculo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Regime</TableHead>
                      <TableHead className="text-right">Base de Cálculo</TableHead>
                      <TableHead className="text-right">Federais</TableHead>
                      <TableHead className="text-right">ISS/IBS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">% Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulationResult.cenarios.map((cenario) => (
                      <TableRow key={cenario.regime}>
                        <TableCell className="font-medium">
                          {cenario.regimeLabel}
                          {cenario.regime === taxConfig?.regime_atual && (
                            <Badge variant="outline" className="ml-2 text-xs">Atual</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.baseCalculo)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.impostosFederais)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cenario.issIbs)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(cenario.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(cenario.percentualReceita)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Diagnósticos */}
            <Card>
              <CardHeader>
                <CardTitle>Diagnósticos e Recomendações</CardTitle>
                <CardDescription>
                  Análises automáticas baseadas nos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {simulationResult.diagnosticos.map((diag, idx) => (
                  <Alert key={idx} variant="default">
                    {getDiagnosticIcon(diag)}
                    <AlertDescription className="ml-2">
                      {cleanDiagnosticText(diag)}
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>

            {/* Comentários Técnicos */}
            <Card>
              <CardHeader>
                <CardTitle>Comentários Técnicos por Regime</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulationResult.cenarios.map((cenario) => (
                  <div key={cenario.regime} className="border-l-4 border-primary pl-4">
                    <h4 className="font-semibold">{cenario.regimeLabel}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {cenario.comentarioTecnico}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Aviso */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Esta ferramenta gera <strong>simulações estimativas</strong> para apoio à decisão. 
                A migração de regime tributário deve ser validada por contador habilitado. 
                Os valores de CBS/IBS são estimativas baseadas na proposta atual da reforma tributária.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Sem dados</AlertTitle>
            <AlertDescription>
              Não há transações aprovadas no período selecionado para realizar a simulação.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
