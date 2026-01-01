import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { 
  FileDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  Users,
  AlertTriangle,
  Building2,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { DashboardFilters, PeriodType, ViewLevel } from '@/components/dashboard/DashboardFilters';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { StatusBadge, getMarginLevel, getFatorRLevel, getCashDifferenceLevel } from '@/components/dashboard/StatusBadge';
import { GaugeChart } from '@/components/dashboard/GaugeChart';
import {
  calculateFolha12,
  calculateRBT12,
  calculateFatorR,
  createEmptyMonthlyData,
  MonthlyFinancialData,
  runTaxSimulation,
} from '@/services/taxSimulator';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { AttendantDashboard } from '@/components/dashboard/AttendantDashboard';
import { FinanceiroDashboard } from '@/components/dashboard/FinanceiroDashboard';
import { ContadorDashboard } from '@/components/dashboard/ContadorDashboard';
import { CompetenceCard } from '@/components/dashboard/CompetenceCard';

// Thresholds configuráveis
const THRESHOLDS = {
  fatorRMinimo: 0.28,
  fatorRSaudavel: 0.32,
  fatorRAtencao: 0.25,
  margemLiquidaSaudavel: 0.15,
  margemLiquidaAtencao: 0.10,
  diferencaCaixaToleravel: 50,
  percentualInformalAlerta: 0.10,
};

// Tooltips explicativos para termos técnicos
const TOOLTIPS = {
  resultado: "Resultado operacional = Receitas - Custos no período selecionado. A margem líquida indica a saúde financeira do negócio.",
  margemLiquida: "Margem Líquida = (Receita - Custos) / Receita. Verde: >15% (saudável), Amarelo: 10-15% (atenção), Vermelho: <10% (problema).",
  caixa: "Compara o saldo esperado (sistema) com o saldo físico (contagem real). Diferenças exigem conferência de envelope/fechamento.",
  fatorR: "Fator R = Folha de Pagamentos (12 meses) ÷ Receita Bruta (12 meses). Determina se a empresa fica no Anexo III (menor imposto) ou Anexo V (maior imposto).",
  anexoIII: "Anexo III: Alíquotas menores do Simples Nacional. A empresa se enquadra quando o Fator R é ≥28%.",
  anexoV: "Anexo V: Alíquotas maiores do Simples Nacional. A empresa fica neste anexo quando o Fator R é <28%.",
  folhaInformal: "Pagamentos 'por fora' que não constam na folha oficial. Representam risco trabalhista, fiscal e não contam para o cálculo do Fator R.",
  simples: "Simples Nacional: Regime tributário simplificado para micro e pequenas empresas com faturamento até R$ 4,8 milhões/ano.",
  presumido: "Lucro Presumido: Regime onde a base de cálculo é presumida (32% para serviços). Indicado para empresas com margens altas.",
  real: "Lucro Real: Regime onde o imposto é calculado sobre o lucro efetivo. Indicado para empresas com margens baixas ou prejuízo.",
  cbsIbs: "CBS (Contribuição sobre Bens e Serviços) e IBS (Imposto sobre Bens e Serviços): Novos tributos da Reforma Tributária que substituirão PIS, COFINS, ICMS, ISS e IPI a partir de 2027.",
  dependencia: "Concentração de receita em poucos clientes/convênios. Representa risco caso algum cliente deixe de pagar ou encerre o contrato.",
  lucratividade: "Resultado por unidade = Receitas da unidade - Custos da unidade. Ajuda a identificar unidades rentáveis e deficitárias.",
  cenariosTributarios: "Comparativo de carga tributária anual estimada para cada regime fiscal (Simples, Presumido, Real, CBS/IBS).",
};

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface CashClosingData {
  unit_id: string | null;
  unit_name: string;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  date: string;
}

interface UnitProfitability {
  unit_id: string;
  unit_name: string;
  receita: number;
  custos: number;
  margem: number;
  margemPercent: number;
}

interface PartnerDependency {
  partner_id: string;
  partner_name: string;
  total: number;
  percent: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading, isSecretaria, isFinanceiro, isContador } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodType>('current');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('consolidated');
  
  // Dados do dashboard
  const [resultado, setResultado] = useState({ receita: 0, custos: 0, margem: 0, variacaoPercent: 0 });
  const [cashClosings, setCashClosings] = useState<CashClosingData[]>([]);
  const [taxScenarios, setTaxScenarios] = useState<{ regime: string; carga: number; percentReceita: number }[]>([]);
  const [fatorRData, setFatorRData] = useState<{
    fatorR: number;
    anexo: 'III' | 'V';
    folhaOficial: number;
    folhaInformal: number;
    custoTotal: number;
    percentInformal: number;
  } | null>(null);
  const [unitProfitability, setUnitProfitability] = useState<UnitProfitability[]>([]);
  const [partnerDependency, setPartnerDependency] = useState<PartnerDependency[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Cálculo de datas baseado no período
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    
    switch (period) {
      case '3m':
        start = startOfMonth(subMonths(now, 2));
        end = endOfMonth(now);
        break;
      case '12m':
        start = startOfMonth(subMonths(now, 11));
        end = endOfMonth(now);
        break;
      default: // current
        start = startOfMonth(now);
        end = endOfMonth(now);
    }
    
    return { start, end };
  }, [period]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && role === 'contabilidade') {
      navigate('/reports/transactions');
    }
    // secretaria e admin ficam no dashboard (secretaria vê AttendantDashboard)
  }, [user, role, authLoading, navigate]);

  // Renderizar dashboard específico por papel
  if (!authLoading && isSecretaria) {
    return <AttendantDashboard />;
  }

  if (!authLoading && isFinanceiro) {
    return <FinanceiroDashboard />;
  }

  if (!authLoading && isContador) {
    return <ContadorDashboard />;
  }

  // Fetch units
  useEffect(() => {
    async function fetchUnits() {
      const { data } = await supabase.from('units').select('id, name, code');
      if (data) setUnits(data);
    }
    fetchUnits();
  }, []);

  // Fetch all dashboard data
  useEffect(() => {
    if (user && role === 'admin') {
      fetchDashboardData();
    }
  }, [user, role, dateRange, selectedUnit]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchResultado(),
        fetchCashClosings(),
        fetchTaxScenarios(),
        fetchFatorRData(),
        fetchUnitProfitability(),
        fetchPartnerDependency(),
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResultado = async () => {
    let query = supabase
      .from('transactions')
      .select('*, category:categories(type, is_informal)')
      .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .is('deleted_at', null);

    if (selectedUnit !== 'all') {
      query = query.eq('unit_id', selectedUnit);
    }

    const { data: txData } = await query;
    setTransactions(txData || []);

    if (!txData) return;

    const receita = txData.filter((t: any) => t.type === 'ENTRADA').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
    const custos = txData.filter((t: any) => t.type === 'SAIDA').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
    const margem = receita - custos;

    // Buscar período anterior para variação
    const prevStart = subMonths(dateRange.start, period === '12m' ? 12 : period === '3m' ? 3 : 1);
    const prevEnd = subMonths(dateRange.end, period === '12m' ? 12 : period === '3m' ? 3 : 1);
    
    let prevQuery = supabase
      .from('transactions')
      .select('*')
      .gte('date', format(prevStart, 'yyyy-MM-dd'))
      .lte('date', format(prevEnd, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .is('deleted_at', null);

    if (selectedUnit !== 'all') {
      prevQuery = prevQuery.eq('unit_id', selectedUnit);
    }

    const { data: prevTxData } = await prevQuery;
    const prevReceita = prevTxData?.filter((t: any) => t.type === 'ENTRADA').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0) || 0;
    const prevCustos = prevTxData?.filter((t: any) => t.type === 'SAIDA').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0) || 0;
    const prevMargem = prevReceita - prevCustos;
    
    const variacaoPercent = prevMargem !== 0 ? ((margem - prevMargem) / Math.abs(prevMargem)) * 100 : 0;

    setResultado({ receita, custos, margem, variacaoPercent });
  };

  const fetchCashClosings = async () => {
    // Buscar último fechamento por unidade
    const { data } = await supabase
      .from('cash_closings')
      .select('*, unit:units(name)')
      .order('date', { ascending: false });

    if (!data) return;

    // Agrupar por unidade, pegando o mais recente
    const latestByUnit = new Map<string, any>();
    data.forEach((closing: any) => {
      const key = closing.unit_id || 'sem_unidade';
      if (!latestByUnit.has(key)) {
        latestByUnit.set(key, closing);
      }
    });

    const closings: CashClosingData[] = Array.from(latestByUnit.values()).map((c: any) => ({
      unit_id: c.unit_id,
      unit_name: c.unit?.name || 'Sem unidade',
      expected_balance: Number(c.expected_balance),
      actual_balance: Number(c.actual_balance),
      difference: Number(c.difference),
      date: c.date,
    }));

    setCashClosings(closings);
  };

  const fetchTaxScenarios = async () => {
    // Buscar dados 12m para simulação tributária
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(endDate, 11));

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, type, tax_group, is_informal, entra_fator_r)')
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .is('deleted_at', null);

    if (selectedUnit !== 'all') {
      query = query.eq('unit_id', selectedUnit);
    }

    const { data: txData } = await query;
    if (!txData || txData.length === 0) {
      setTaxScenarios([]);
      return;
    }

    // Processar em dados mensais
    const monthlyDataMap = new Map<string, MonthlyFinancialData>();
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(endDate, 11 - i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyDataMap.set(monthKey, createEmptyMonthlyData(monthKey));
    }

    txData.forEach((tx: any) => {
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
            const catName = tx.category?.name?.toLowerCase() || '';
            const isInformal = tx.category?.is_informal || false;
            if (isInformal) {
              data.folha_informal += amount;
            } else if (catName.includes('pró-labore') || catName.includes('pro-labore')) {
              data.folha_prolabore += amount;
            } else if (catName.includes('inss') || catName.includes('fgts') || catName.includes('encargo')) {
              data.folha_encargos += amount;
            } else {
              data.folha_salarios += amount;
            }
            break;
          case 'IMPOSTO':
            data.impostos_pagos += amount;
            break;
          case 'CUSTO_SERVICO':
            data.servicos_terceiros += amount;
            break;
          case 'DESPESA_OPERACIONAL':
            data.despesas_administrativas += amount;
            break;
        }
      }
    });

    const monthlyDataArray = Array.from(monthlyDataMap.values());
    const rbt12 = calculateRBT12(monthlyDataArray);
    const folha12 = calculateFolha12(monthlyDataArray);
    const fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;
    
    try {
      // Calcular cenários simplificados diretamente
      const receitaMensal = rbt12 / 12;
      const simplesAnexo = fatorR >= 0.28 ? 'III' : 'V';
      const aliquotaSimples = simplesAnexo === 'III' ? 0.112 : 0.18; // Aproximação faixa 2
      const aliquotaPresumido = 0.1365; // 32% × (15% IRPJ + 9% CSLL) + PIS/COFINS
      const aliquotaReal = 0.14; // Estimativa
      const aliquotaCBS = 0.088 * 0.4; // Com redução saúde

      const scenarios = [
        { regime: 'SIMPLES', carga: rbt12 * aliquotaSimples, percentReceita: aliquotaSimples * 100 },
        { regime: 'PRESUMIDO', carga: rbt12 * aliquotaPresumido, percentReceita: aliquotaPresumido * 100 },
        { regime: 'REAL', carga: rbt12 * aliquotaReal, percentReceita: aliquotaReal * 100 },
        { regime: 'CBS/IBS', carga: rbt12 * aliquotaCBS, percentReceita: aliquotaCBS * 100 },
      ].map(c => ({
        regime: c.regime,
        carga: c.carga,
        percentReceita: c.percentReceita,
      }));

      setTaxScenarios(scenarios);
    } catch (error) {
      console.error('Error running tax simulation:', error);
    }
  };

  const fetchFatorRData = async () => {
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(endDate, 11));

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, type, tax_group, is_informal, entra_fator_r)')
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .is('deleted_at', null);

    if (selectedUnit !== 'all') {
      query = query.eq('unit_id', selectedUnit);
    }

    const { data: txData } = await query;
    if (!txData) return;

    // Processar folha oficial vs informal
    let folhaOficial = 0;
    let folhaInformal = 0;
    let receitaServicos = 0;

    txData.forEach((tx: any) => {
      const amount = Math.abs(Number(tx.amount));
      const taxGroup = tx.category?.tax_group;
      const isInformal = tx.category?.is_informal || false;
      const entraFatorR = tx.category?.entra_fator_r || false;

      if (tx.type === 'ENTRADA' && taxGroup === 'RECEITA_SERVICOS') {
        receitaServicos += amount;
      } else if (tx.type === 'SAIDA' && taxGroup === 'PESSOAL') {
        if (isInformal) {
          folhaInformal += amount;
        } else if (entraFatorR) {
          folhaOficial += amount;
        }
      }
    });

    const custoTotal = folhaOficial + folhaInformal;
    const fatorR = receitaServicos > 0 ? folhaOficial / receitaServicos : 0;
    const anexo = fatorR >= THRESHOLDS.fatorRMinimo ? 'III' : 'V';
    const percentInformal = custoTotal > 0 ? folhaInformal / custoTotal : 0;

    setFatorRData({
      fatorR,
      anexo,
      folhaOficial,
      folhaInformal,
      custoTotal,
      percentInformal,
    });
  };

  const fetchUnitProfitability = async () => {
    if (selectedUnit !== 'all') {
      setUnitProfitability([]);
      return;
    }

    const { data: txData } = await supabase
      .from('transactions')
      .select('*, unit:units(id, name)')
      .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .is('deleted_at', null);

    if (!txData) return;

    const unitMap = new Map<string, { receita: number; custos: number; name: string }>();
    
    txData.forEach((tx: any) => {
      const unitId = tx.unit_id || 'sem_unidade';
      const unitName = tx.unit?.name || 'Sem unidade';
      const amount = Math.abs(Number(tx.amount));

      if (!unitMap.has(unitId)) {
        unitMap.set(unitId, { receita: 0, custos: 0, name: unitName });
      }

      const data = unitMap.get(unitId)!;
      if (tx.type === 'ENTRADA') {
        data.receita += amount;
      } else {
        data.custos += amount;
      }
    });

    const profitability: UnitProfitability[] = Array.from(unitMap.entries()).map(([id, data]) => ({
      unit_id: id,
      unit_name: data.name,
      receita: data.receita,
      custos: data.custos,
      margem: data.receita - data.custos,
      margemPercent: data.receita > 0 ? ((data.receita - data.custos) / data.receita) * 100 : 0,
    })).sort((a, b) => b.margem - a.margem);

    setUnitProfitability(profitability);
  };

  const fetchPartnerDependency = async () => {
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, partner:partners(id, name)')
      .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
      .eq('status', 'APROVADO')
      .eq('type', 'ENTRADA')
      .is('deleted_at', null)
      .not('partner_id', 'is', null);

    if (!txData) return;

    const partnerMap = new Map<string, { name: string; total: number }>();
    let totalReceita = 0;

    txData.forEach((tx: any) => {
      const partnerId = tx.partner_id;
      const partnerName = tx.partner?.name || 'Parceiro desconhecido';
      const amount = Math.abs(Number(tx.amount));
      totalReceita += amount;

      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { name: partnerName, total: 0 });
      }
      partnerMap.get(partnerId)!.total += amount;
    });

    const dependency: PartnerDependency[] = Array.from(partnerMap.entries())
      .map(([id, data]) => ({
        partner_id: id,
        partner_name: data.name,
        total: data.total,
        percent: totalReceita > 0 ? (data.total / totalReceita) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    setPartnerDependency(dependency);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const periodLabel = period === '12m' ? 'Últimos 12 meses' : period === '3m' ? 'Últimos 3 meses' : format(dateRange.start, 'MMMM yyyy', { locale: ptBR });
    
    doc.setFontSize(18);
    doc.text(`Dashboard Executivo - ${periodLabel}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Receita Total: R$ ${resultado.receita.toFixed(2)}`, 20, 40);
    doc.text(`Custos Totais: R$ ${resultado.custos.toFixed(2)}`, 20, 50);
    doc.text(`Resultado: R$ ${resultado.margem.toFixed(2)}`, 20, 60);
    
    if (fatorRData) {
      doc.text(`Fator R: ${(fatorRData.fatorR * 100).toFixed(1)}%`, 20, 80);
      doc.text(`Anexo: ${fatorRData.anexo}`, 20, 90);
    }
    
    doc.save(`dashboard_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const exportToExcel = () => {
    const data = transactions.map((t: any) => ({
      'Data': format(new Date(t.date), 'dd/MM/yyyy'),
      'Tipo': t.type,
      'Valor': Number(t.amount),
      'Categoria': t.category?.name || '',
      'Status': t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, `dashboard_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exportado com sucesso!');
  };

  const margemPercent = resultado.receita > 0 ? resultado.margem / resultado.receita : 0;
  const margemLevel = getMarginLevel(margemPercent);

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel de Comando</h1>
            <p className="text-muted-foreground text-sm">
              Visão executiva alinhada aos 5 objetivos do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileDown className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <DashboardFilters
          units={units}
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          period={period}
          onPeriodChange={setPeriod}
          viewLevel={viewLevel}
          onViewLevelChange={setViewLevel}
        />

        {/* Fila 1: Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Resultado e Prestação de Contas */}
          <DashboardCard
            title="Resultado"
            subtitle={(margemPercent * 100).toFixed(1) + '% margem'}
            icon={TrendingUp}
            status={margemLevel}
            value={resultado.margem}
            valuePrefix="R$ "
            tooltip={TOOLTIPS.resultado}
            linkTo="/reports/transactions"
            linkLabel="Ver relatório detalhado"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {resultado.variacaoPercent !== 0 && (
                <span className={`flex items-center gap-1 ${resultado.variacaoPercent > 0 ? 'text-success' : 'text-destructive'}`}>
                  {resultado.variacaoPercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {resultado.variacaoPercent > 0 ? '+' : ''}{resultado.variacaoPercent.toFixed(1)}% vs período anterior
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita: {formatCurrency(resultado.receita)} | Custos: {formatCurrency(resultado.custos)}
            </p>
          </DashboardCard>

          {/* Card 1.5: DRE por Competência */}
          <CompetenceCard selectedUnit={selectedUnit} dateRange={dateRange} />

          {/* Card 2: Caixa & Extratos por Unidade */}
          <DashboardCard
            title="Caixa por Unidade"
            icon={Wallet}
            tooltip={TOOLTIPS.caixa}
            linkTo="/cash-closing"
            linkLabel="Ver fechamentos"
          >
            {cashClosings.length > 0 ? (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-1 text-xs font-medium text-muted-foreground pb-1 border-b">
                  <span>Unidade</span>
                  <span className="text-right">Sistema</span>
                  <span className="text-right">Físico</span>
                  <span className="text-right">Dif.</span>
                </div>
                {cashClosings.slice(0, 4).map((c) => {
                  const diffLevel = getCashDifferenceLevel(c.difference, THRESHOLDS.diferencaCaixaToleravel);
                  return (
                    <div key={c.unit_id || 'sem'} className="grid grid-cols-4 gap-1 text-xs py-1">
                      <span className="truncate">{c.unit_name}</span>
                      <span className="text-right">{formatCurrency(c.expected_balance)}</span>
                      <span className="text-right">{formatCurrency(c.actual_balance)}</span>
                      <span className={`text-right font-medium ${diffLevel === 'success' ? 'text-success' : diffLevel === 'warning' ? 'text-warning' : 'text-destructive'}`}>
                        {formatCurrency(c.difference)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum fechamento registrado</p>
            )}
          </DashboardCard>

          {/* Card 3: Regime Tributário */}
          <DashboardCard
            title="Cenários Tributários"
            icon={Calculator}
            tooltip={TOOLTIPS.cenariosTributarios}
            linkTo="/reports/tax-scenarios"
            linkLabel="Abrir cenários"
          >
            {taxScenarios.length > 0 ? (
              <div className="space-y-2">
                {taxScenarios.map((scenario) => {
                  const isLowest = scenario.carga === Math.min(...taxScenarios.map(s => s.carga));
                  const regimeTooltip = scenario.regime === 'SIMPLES' ? TOOLTIPS.simples 
                    : scenario.regime === 'PRESUMIDO' ? TOOLTIPS.presumido 
                    : scenario.regime === 'REAL' ? TOOLTIPS.real 
                    : TOOLTIPS.cbsIbs;
                  return (
                    <TooltipProvider key={scenario.regime}>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <span className="text-xs w-20 truncate">{scenario.regime}</span>
                            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isLowest ? 'bg-success' : 'bg-primary/60'}`}
                                style={{ width: `${Math.min(scenario.percentReceita * 3, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium w-14 text-right ${isLowest ? 'text-success' : ''}`}>
                              {scenario.percentReceita.toFixed(1)}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{regimeTooltip}</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  );
                })}
                {taxScenarios.length > 0 && (
                  <p className="text-xs text-success font-medium mt-2">
                    ✓ Melhor: {taxScenarios.reduce((a, b) => a.carga < b.carga ? a : b).regime}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados para simulação</p>
            )}
          </DashboardCard>

          {/* Card 4: Fator R & Folha */}
          <DashboardCard
            title="Fator R & Folha"
            icon={Users}
            status={fatorRData ? getFatorRLevel(fatorRData.fatorR) : 'default'}
            tooltip={TOOLTIPS.fatorR}
            linkTo="/reports/tax-scenarios"
            linkLabel="Ver simulador Fator R"
          >
            {fatorRData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <GaugeChart
                    value={fatorRData.fatorR}
                    min={0}
                    max={0.5}
                    targetLine={THRESHOLDS.fatorRMinimo}
                    size={120}
                  />
                  <div className="text-right">
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <StatusBadge level={fatorRData.anexo === 'III' ? 'success' : 'danger'}>
                              Anexo {fatorRData.anexo}
                            </StatusBadge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{fatorRData.anexo === 'III' ? TOOLTIPS.anexoIII : TOOLTIPS.anexoV}</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folha oficial (12m):</span>
                    <span className="font-medium">{formatCurrency(fatorRData.folhaOficial)}</span>
                  </div>
                  {fatorRData.folhaInformal > 0 && (
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-between text-warning cursor-help">
                            <span>Pagamentos informais:</span>
                            <span className="font-medium">{formatCurrency(fatorRData.folhaInformal)} ({(fatorRData.percentInformal * 100).toFixed(0)}%)</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{TOOLTIPS.folhaInformal}</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  )}
                </div>
                
                {fatorRData.fatorR < THRESHOLDS.fatorRMinimo && (
                  <p className="text-xs text-destructive">
                    ⚠ Fator R {(fatorRData.fatorR * 100).toFixed(1)}% — risco de ficar no Anexo V
                  </p>
                )}
                
                <Link to="/reports/personnel-real-vs-official" className="inline-flex items-center text-xs text-primary hover:underline">
                  Ver Real x Oficial <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados de folha</p>
            )}
          </DashboardCard>
        </div>

        {/* Fila 2: Blocos de Profundidade */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lucratividade por Unidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Lucratividade por Unidade
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{TOOLTIPS.lucratividade}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Margem de cada unidade no período</CardDescription>
            </CardHeader>
            <CardContent>
              {unitProfitability.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={unitProfitability} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="unit_name" width={80} className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                      {unitProfitability.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.margemPercent >= 15 ? 'hsl(var(--success))' : entry.margemPercent >= 10 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  {selectedUnit !== 'all' ? 'Selecione "Todas" para ver por unidade' : 'Sem dados de transações'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riscos: Informalidade e Dependência */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Riscos: Informalidade & Dependência
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{TOOLTIPS.folhaInformal} {TOOLTIPS.dependencia}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Pagamentos informais e concentração de receita</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Informalidade */}
              {fatorRData && fatorRData.percentInformal > 0 && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center justify-between mb-2">
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-medium text-warning cursor-help">Pagamentos Informais</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{TOOLTIPS.folhaInformal}</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                    <StatusBadge level={fatorRData.percentInformal > THRESHOLDS.percentualInformalAlerta ? 'danger' : 'warning'}>
                      {(fatorRData.percentInformal * 100).toFixed(0)}% do custo de pessoal
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(fatorRData.folhaInformal)} em pagamentos "por fora" — risco trabalhista e fiscal
                  </p>
                </div>
              )}

              {/* Dependência de parceiros */}
              {partnerDependency.length > 0 && (
                <div className="space-y-2">
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium cursor-help">Top Convênios/Clientes por Receita</p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">{TOOLTIPS.dependencia}</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                  {partnerDependency.map((p) => (
                    <div key={p.partner_id} className="flex items-center gap-2">
                      <span className="text-xs truncate flex-1">{p.partner_name}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${p.percent > 30 ? 'bg-destructive' : p.percent > 20 ? 'bg-warning' : 'bg-primary'}`}
                          style={{ width: `${Math.min(p.percent, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-12 text-right ${p.percent > 30 ? 'text-destructive' : ''}`}>
                        {p.percent.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {partnerDependency.slice(0, 2).reduce((sum, p) => sum + p.percent, 0) > 50 && (
                    <p className="text-xs text-warning mt-2">
                      ⚠ Top 2 clientes concentram {partnerDependency.slice(0, 2).reduce((sum, p) => sum + p.percent, 0).toFixed(0)}% da receita
                    </p>
                  )}
                </div>
              )}

              {!fatorRData?.percentInformal && partnerDependency.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum risco identificado no período
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
