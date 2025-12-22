/**
 * Serviço de Simulação Tributária para Laboratórios de Análises Clínicas
 * 
 * Implementa cálculos para:
 * - Simples Nacional (Anexo III e V com Fator R)
 * - Lucro Presumido
 * - Lucro Real
 * - Reforma Tributária (CBS/IBS)
 */

import { TaxGroup } from '@/types/database';

// ==================== TIPOS ====================

export interface SimplesNacionalFaixa {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquota: number;
  deducao: number;
}

export interface TaxParameters {
  ano: number;
  // Lucro Presumido
  presuncao_servicos: number;
  pis_cumulativo: number;
  cofins_cumulativo: number;
  // Lucro Real
  irpj_aliquota: number;
  irpj_adicional: number;
  irpj_adicional_limite: number;
  csll_aliquota: number;
  pis_nao_cumulativo: number;
  cofins_nao_cumulativo: number;
  // Reforma Tributária
  cbs_aliquota: number;
  ibs_aliquota: number;
  reducao_saude: number;
  // Simples Nacional
  simples_anexo3_faixas: SimplesNacionalFaixa[];
  simples_anexo5_faixas: SimplesNacionalFaixa[];
}

export interface TaxConfig {
  regime_atual: 'SIMPLES' | 'PRESUMIDO' | 'REAL';
  iss_aliquota: number;
  cnpj?: string;
}

export interface MonthlyFinancialData {
  mes: string; // YYYY-MM
  receita_servicos: number;
  receita_outras: number;
  folha_salarios: number;
  folha_prolabore: number;
  folha_encargos: number; // INSS patronal + FGTS
  folha_informal: number; // Pagamentos informais ("por fora") - NÃO entra no Fator R
  insumos: number;
  servicos_terceiros: number;
  despesas_administrativas: number;
  despesas_financeiras: number;
  impostos_pagos: number; // DAS, ISS, etc
}

export interface TaxScenarioResult {
  regime: 'SIMPLES' | 'PRESUMIDO' | 'REAL' | 'CBS_IBS';
  regimeLabel: string;
  baseCalculo: number;
  impostosFederais: number;
  issIbs: number;
  total: number;
  percentualReceita: number;
  detalhes: TaxScenarioDetails;
  comentarioTecnico: string;
}

export interface TaxScenarioDetails {
  // Simples
  fatorR?: number;
  anexo?: 'III' | 'V';
  aliquotaEfetiva?: number;
  rbt12?: number;
  // Presumido
  irpj?: number;
  csll?: number;
  pis?: number;
  cofins?: number;
  // Real
  lucroContabil?: number;
  creditosPisCofins?: number;
  // CBS/IBS
  cbsBruto?: number;
  ibsBruto?: number;
  creditosCbsIbs?: number;
}

export interface TaxSimulationInput {
  monthlyData: MonthlyFinancialData;
  last12MonthsData: MonthlyFinancialData[];
  taxConfig: TaxConfig;
  taxParameters: TaxParameters;
}

export interface TaxSimulationOutput {
  mes: string;
  receitaTotal: number;
  fatorR: number;
  anexoSimples: 'III' | 'V';
  cenarios: TaxScenarioResult[];
  diagnosticos: string[];
  melhorCenario: TaxScenarioResult;
}

// ==================== FUNÇÕES DE CÁLCULO ====================

/**
 * Calcula a Receita Bruta Total dos últimos 12 meses (RBT12)
 */
export function calculateRBT12(last12MonthsData: MonthlyFinancialData[]): number {
  return last12MonthsData.reduce((sum, m) => sum + m.receita_servicos + m.receita_outras, 0);
}

/**
 * Calcula o total da folha de pagamento dos últimos 12 meses (Folha12)
 * Inclui: salários + pró-labore + encargos
 */
export function calculateFolha12(last12MonthsData: MonthlyFinancialData[]): number {
  return last12MonthsData.reduce((sum, m) => 
    sum + m.folha_salarios + m.folha_prolabore + m.folha_encargos, 0
  );
}

/**
 * Calcula o Fator R (Folha12 / RBT12)
 * Determina se a empresa fica no Anexo III ou V do Simples
 */
export function calculateFatorR(folha12: number, rbt12: number): number {
  if (rbt12 === 0) return 0;
  return folha12 / rbt12;
}

/**
 * Determina qual Anexo do Simples se aplica baseado no Fator R
 * Fator R >= 28% = Anexo III (alíquotas menores)
 * Fator R < 28% = Anexo V (alíquotas maiores)
 */
export function determineSimplexAnexo(fatorR: number): 'III' | 'V' {
  return fatorR >= 0.28 ? 'III' : 'V';
}

/**
 * Encontra a faixa do Simples Nacional baseada no RBT12
 */
function findSimplesFaixa(rbt12: number, faixas: SimplesNacionalFaixa[]): SimplesNacionalFaixa | null {
  return faixas.find(f => rbt12 >= f.limiteInferior && rbt12 <= f.limiteSuperior) || null;
}

/**
 * Calcula a alíquota efetiva do Simples Nacional
 * Fórmula: ((RBT12 × Alíquota) - Parcela a Deduzir) ÷ RBT12
 */
export function calculateAliquotaEfetivaSimples(
  rbt12: number, 
  faixas: SimplesNacionalFaixa[]
): number {
  const faixa = findSimplesFaixa(rbt12, faixas);
  if (!faixa || rbt12 === 0) return 0;
  
  const aliquotaEfetiva = ((rbt12 * faixa.aliquota) - faixa.deducao) / rbt12;
  return Math.max(0, aliquotaEfetiva);
}

/**
 * Simula o Simples Nacional para o mês
 */
export function simulateSimples(
  input: TaxSimulationInput
): TaxScenarioResult {
  const { monthlyData, last12MonthsData, taxConfig, taxParameters } = input;
  
  const receitaMes = monthlyData.receita_servicos + monthlyData.receita_outras;
  const rbt12 = calculateRBT12(last12MonthsData);
  const folha12 = calculateFolha12(last12MonthsData);
  const fatorR = calculateFatorR(folha12, rbt12);
  const anexo = determineSimplexAnexo(fatorR);
  
  const faixas = anexo === 'III' 
    ? taxParameters.simples_anexo3_faixas 
    : taxParameters.simples_anexo5_faixas;
  
  const aliquotaEfetiva = calculateAliquotaEfetivaSimples(rbt12, faixas);
  const impostoTotal = receitaMes * aliquotaEfetiva;
  
  // ISS já está incluso no Simples, mas pode haver ISS retido
  const issRetido = receitaMes * taxConfig.iss_aliquota * 0.2; // Estimativa 20% retido
  
  let comentario = '';
  if (fatorR < 0.28) {
    comentario = `Fator R de ${(fatorR * 100).toFixed(1)}% está abaixo de 28%, enquadrando no Anexo V com alíquotas mais altas. Considere aumentar a folha de pagamento ou pró-labore.`;
  } else {
    comentario = `Fator R de ${(fatorR * 100).toFixed(1)}% acima de 28%, aproveitando o Anexo III com alíquotas reduzidas.`;
  }
  
  return {
    regime: 'SIMPLES',
    regimeLabel: 'Simples Nacional',
    baseCalculo: receitaMes,
    impostosFederais: impostoTotal - issRetido,
    issIbs: issRetido,
    total: impostoTotal,
    percentualReceita: receitaMes > 0 ? (impostoTotal / receitaMes) * 100 : 0,
    detalhes: {
      fatorR,
      anexo,
      aliquotaEfetiva,
      rbt12,
    },
    comentarioTecnico: comentario,
  };
}

/**
 * Simula o Lucro Presumido para o mês
 */
export function simulateLucroPresumido(
  input: TaxSimulationInput
): TaxScenarioResult {
  const { monthlyData, taxConfig, taxParameters } = input;
  
  const receitaMes = monthlyData.receita_servicos + monthlyData.receita_outras;
  
  // Base de presunção para serviços: 32%
  const basePresumida = receitaMes * taxParameters.presuncao_servicos;
  
  // IRPJ: 15% sobre base presumida + 10% adicional sobre excedente de R$ 20.000/mês
  const irpjBase = basePresumida * taxParameters.irpj_aliquota;
  const irpjAdicional = basePresumida > taxParameters.irpj_adicional_limite 
    ? (basePresumida - taxParameters.irpj_adicional_limite) * taxParameters.irpj_adicional 
    : 0;
  const irpj = irpjBase + irpjAdicional;
  
  // CSLL: 9% sobre base presumida
  const csll = basePresumida * taxParameters.csll_aliquota;
  
  // PIS/COFINS cumulativo sobre receita bruta
  const pis = receitaMes * taxParameters.pis_cumulativo;
  const cofins = receitaMes * taxParameters.cofins_cumulativo;
  
  // ISS sobre receita
  const iss = receitaMes * taxConfig.iss_aliquota;
  
  const impostosFederais = irpj + csll + pis + cofins;
  const total = impostosFederais + iss;
  
  const margemPresumida = taxParameters.presuncao_servicos * 100;
  const comentario = `Base presumida de ${margemPresumida}% sobre receita. PIS/COFINS cumulativo sem direito a créditos.`;
  
  return {
    regime: 'PRESUMIDO',
    regimeLabel: 'Lucro Presumido',
    baseCalculo: basePresumida,
    impostosFederais,
    issIbs: iss,
    total,
    percentualReceita: receitaMes > 0 ? (total / receitaMes) * 100 : 0,
    detalhes: {
      irpj,
      csll,
      pis,
      cofins,
    },
    comentarioTecnico: comentario,
  };
}

/**
 * Simula o Lucro Real para o mês
 */
export function simulateLucroReal(
  input: TaxSimulationInput
): TaxScenarioResult {
  const { monthlyData, taxConfig, taxParameters } = input;
  
  const receitaMes = monthlyData.receita_servicos + monthlyData.receita_outras;
  
  // Despesas dedutíveis
  const despesasDedutíveis = 
    monthlyData.folha_salarios +
    monthlyData.folha_prolabore +
    monthlyData.folha_encargos +
    monthlyData.insumos +
    monthlyData.servicos_terceiros +
    monthlyData.despesas_administrativas +
    monthlyData.despesas_financeiras;
  
  // Lucro contábil estimado
  const lucroContabil = Math.max(0, receitaMes - despesasDedutíveis);
  
  // IRPJ: 15% sobre lucro + 10% adicional sobre excedente
  const irpjBase = lucroContabil * taxParameters.irpj_aliquota;
  const irpjAdicional = lucroContabil > taxParameters.irpj_adicional_limite
    ? (lucroContabil - taxParameters.irpj_adicional_limite) * taxParameters.irpj_adicional
    : 0;
  const irpj = irpjBase + irpjAdicional;
  
  // CSLL: 9% sobre lucro
  const csll = lucroContabil * taxParameters.csll_aliquota;
  
  // PIS/COFINS não-cumulativo com créditos
  const pisBruto = receitaMes * taxParameters.pis_nao_cumulativo;
  const cofinsBruto = receitaMes * taxParameters.cofins_nao_cumulativo;
  
  // Créditos sobre insumos e serviços (simplificado: 100% insumos, 80% serviços terceiros)
  const baseCreditos = monthlyData.insumos + (monthlyData.servicos_terceiros * 0.8);
  const creditoPis = baseCreditos * taxParameters.pis_nao_cumulativo;
  const creditoCofins = baseCreditos * taxParameters.cofins_nao_cumulativo;
  
  const pis = Math.max(0, pisBruto - creditoPis);
  const cofins = Math.max(0, cofinsBruto - creditoCofins);
  
  // ISS sobre receita
  const iss = receitaMes * taxConfig.iss_aliquota;
  
  const impostosFederais = irpj + csll + pis + cofins;
  const total = impostosFederais + iss;
  
  const margemLiquida = receitaMes > 0 ? (lucroContabil / receitaMes) * 100 : 0;
  let comentario = '';
  
  if (margemLiquida < 32) {
    comentario = `Margem líquida de ${margemLiquida.toFixed(1)}% menor que presunção de 32%, Lucro Real pode ser vantajoso.`;
  } else {
    comentario = `Margem líquida de ${margemLiquida.toFixed(1)}% acima da presunção, Lucro Presumido pode ser mais econômico.`;
  }
  
  return {
    regime: 'REAL',
    regimeLabel: 'Lucro Real',
    baseCalculo: lucroContabil,
    impostosFederais,
    issIbs: iss,
    total,
    percentualReceita: receitaMes > 0 ? (total / receitaMes) * 100 : 0,
    detalhes: {
      irpj,
      csll,
      pis,
      cofins,
      lucroContabil,
      creditosPisCofins: creditoPis + creditoCofins,
    },
    comentarioTecnico: comentario,
  };
}

/**
 * Simula a Reforma Tributária (CBS/IBS) para o mês
 * Estimativas baseadas na proposta atual com redução de 60% para saúde
 */
export function simulateCBSIBS(
  input: TaxSimulationInput
): TaxScenarioResult {
  const { monthlyData, taxParameters } = input;
  
  const receitaMes = monthlyData.receita_servicos + monthlyData.receita_outras;
  
  // Alíquotas com redução de 60% para serviços de saúde
  const fatorReducao = 1 - taxParameters.reducao_saude;
  const cbsAliquotaReduzida = taxParameters.cbs_aliquota * fatorReducao;
  const ibsAliquotaReduzida = taxParameters.ibs_aliquota * fatorReducao;
  
  // CBS (federal) e IBS (estadual/municipal) sobre receita
  const cbsBruto = receitaMes * cbsAliquotaReduzida;
  const ibsBruto = receitaMes * ibsAliquotaReduzida;
  
  // Créditos sobre insumos e serviços (similar ao Lucro Real)
  const baseCreditos = monthlyData.insumos + (monthlyData.servicos_terceiros * 0.8);
  const creditoCbs = baseCreditos * cbsAliquotaReduzida;
  const creditoIbs = baseCreditos * ibsAliquotaReduzida;
  
  const cbs = Math.max(0, cbsBruto - creditoCbs);
  const ibs = Math.max(0, ibsBruto - creditoIbs);
  
  // IRPJ e CSLL permanecem (estimativa com Lucro Real)
  const despesasDedutíveis = 
    monthlyData.folha_salarios +
    monthlyData.folha_prolabore +
    monthlyData.folha_encargos +
    monthlyData.insumos +
    monthlyData.servicos_terceiros +
    monthlyData.despesas_administrativas +
    monthlyData.despesas_financeiras;
  
  const lucroContabil = Math.max(0, receitaMes - despesasDedutíveis);
  const irpj = lucroContabil * taxParameters.irpj_aliquota;
  const csll = lucroContabil * taxParameters.csll_aliquota;
  
  const impostosFederais = irpj + csll + cbs;
  const total = impostosFederais + ibs;
  
  const aliquotaEfetivaCbsIbs = (cbsAliquotaReduzida + ibsAliquotaReduzida) * 100;
  const comentario = `Reforma Tributária (2027+): CBS/IBS com redução de ${taxParameters.reducao_saude * 100}% para saúde, alíquota efetiva de ~${aliquotaEfetivaCbsIbs.toFixed(1)}%. Valores estimados, sujeitos a alterações.`;
  
  return {
    regime: 'CBS_IBS',
    regimeLabel: 'CBS/IBS (Reforma)',
    baseCalculo: receitaMes,
    impostosFederais,
    issIbs: ibs,
    total,
    percentualReceita: receitaMes > 0 ? (total / receitaMes) * 100 : 0,
    detalhes: {
      irpj,
      csll,
      cbsBruto,
      ibsBruto,
      creditosCbsIbs: creditoCbs + creditoIbs,
    },
    comentarioTecnico: comentario,
  };
}

/**
 * Gera diagnósticos automáticos baseados nos cenários
 */
export function generateDiagnostics(
  cenarios: TaxScenarioResult[],
  fatorR: number,
  receitaTotal: number,
  regimeAtual: string
): string[] {
  const diagnosticos: string[] = [];
  
  const cenarioAtual = cenarios.find(c => c.regime === regimeAtual);
  const melhorCenario = cenarios.reduce((a, b) => a.total < b.total ? a : b);
  
  // Diagnóstico do Fator R
  if (fatorR < 0.28) {
    diagnosticos.push(
      `⚠️ Fator R atual: ${(fatorR * 100).toFixed(1)}% - Abaixo de 28%, enquadrado no Anexo V do Simples com alíquotas mais altas. ` +
      `Considere aumentar pró-labore ou salários para atingir 28% e migrar para Anexo III.`
    );
  } else if (fatorR >= 0.28 && fatorR < 0.35) {
    diagnosticos.push(
      `✅ Fator R atual: ${(fatorR * 100).toFixed(1)}% - Acima de 28%, aproveitando o Anexo III. ` +
      `Margem próxima do limite, monitore para manter acima de 28%.`
    );
  } else {
    diagnosticos.push(
      `✅ Fator R atual: ${(fatorR * 100).toFixed(1)}% - Bem acima de 28%, benefício máximo do Anexo III garantido.`
    );
  }
  
  // Comparação de cenários
  if (cenarioAtual && melhorCenario.regime !== regimeAtual) {
    const economia = cenarioAtual.total - melhorCenario.total;
    const percentualEconomia = (economia / cenarioAtual.total) * 100;
    
    if (economia > 0) {
      diagnosticos.push(
        `💡 O ${melhorCenario.regimeLabel} seria ${percentualEconomia.toFixed(1)}% mais econômico neste mês ` +
        `(economia de R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
      );
    }
  }
  
  // Análise do Lucro Real
  const cenarioReal = cenarios.find(c => c.regime === 'REAL');
  const cenarioPresumido = cenarios.find(c => c.regime === 'PRESUMIDO');
  
  if (cenarioReal && cenarioPresumido) {
    const margemReal = cenarioReal.detalhes.lucroContabil 
      ? (cenarioReal.detalhes.lucroContabil / receitaTotal) * 100 
      : 0;
    
    if (margemReal < 32) {
      diagnosticos.push(
        `📊 Margem líquida de ${margemReal.toFixed(1)}% é menor que a presunção de 32%, ` +
        `favorecendo o Lucro Real como opção tributária.`
      );
    }
  }
  
  // Análise da Reforma Tributária
  const cenarioCBS = cenarios.find(c => c.regime === 'CBS_IBS');
  if (cenarioCBS && cenarioAtual) {
    const impacto = ((cenarioCBS.total - cenarioAtual.total) / cenarioAtual.total) * 100;
    
    if (Math.abs(impacto) > 5) {
      const direcao = impacto > 0 ? 'aumento' : 'redução';
      diagnosticos.push(
        `🔮 Reforma Tributária (2027+): Impacto estimado de ${direcao} de ${Math.abs(impacto).toFixed(1)}% na carga tributária. ` +
        `Laboratórios de saúde têm redução de 60% nas novas alíquotas CBS/IBS.`
      );
    } else {
      diagnosticos.push(
        `🔮 Reforma Tributária (2027+): Impacto neutro estimado (variação de ${impacto.toFixed(1)}%). ` +
        `Valores são estimativas e podem mudar.`
      );
    }
  }
  
  return diagnosticos;
}

/**
 * Executa a simulação completa para todos os cenários
 */
export function runTaxSimulation(input: TaxSimulationInput): TaxSimulationOutput {
  const { monthlyData, last12MonthsData, taxConfig } = input;
  
  const receitaTotal = monthlyData.receita_servicos + monthlyData.receita_outras;
  const rbt12 = calculateRBT12(last12MonthsData);
  const folha12 = calculateFolha12(last12MonthsData);
  const fatorR = calculateFatorR(folha12, rbt12);
  const anexoSimples = determineSimplexAnexo(fatorR);
  
  const cenarios: TaxScenarioResult[] = [
    simulateSimples(input),
    simulateLucroPresumido(input),
    simulateLucroReal(input),
    simulateCBSIBS(input),
  ];
  
  const diagnosticos = generateDiagnostics(cenarios, fatorR, receitaTotal, taxConfig.regime_atual);
  const melhorCenario = cenarios.reduce((a, b) => a.total < b.total ? a : b);
  
  return {
    mes: monthlyData.mes,
    receitaTotal,
    fatorR,
    anexoSimples,
    cenarios,
    diagnosticos,
    melhorCenario,
  };
}

/**
 * Mapeia tax_group das categorias para os grupos de despesa do simulador
 */
export function mapTaxGroupToFinancialCategory(taxGroup: TaxGroup | null): keyof MonthlyFinancialData | null {
  const mapping: Record<TaxGroup, keyof MonthlyFinancialData> = {
    'RECEITA_SERVICOS': 'receita_servicos',
    'RECEITA_OUTRAS': 'receita_outras',
    'INSUMOS': 'insumos',
    'PESSOAL': 'folha_salarios', // Será refinado posteriormente
    'SERVICOS_TERCEIROS': 'servicos_terceiros',
    'ADMINISTRATIVAS': 'despesas_administrativas',
    'FINANCEIRAS': 'despesas_financeiras',
    'TRIBUTARIAS': 'impostos_pagos',
  };
  
  return taxGroup ? mapping[taxGroup] : null;
}

/**
 * Cria dados financeiros vazios para um mês
 */
export function createEmptyMonthlyData(mes: string): MonthlyFinancialData {
  return {
    mes,
    receita_servicos: 0,
    receita_outras: 0,
    folha_salarios: 0,
    folha_prolabore: 0,
    folha_encargos: 0,
    folha_informal: 0,
    insumos: 0,
    servicos_terceiros: 0,
    despesas_administrativas: 0,
    despesas_financeiras: 0,
    impostos_pagos: 0,
  };
}

/**
 * Parâmetros padrão para 2025 (fallback se não houver dados no banco)
 */
export const DEFAULT_TAX_PARAMETERS: TaxParameters = {
  ano: 2025,
  presuncao_servicos: 0.32,
  pis_cumulativo: 0.0065,
  cofins_cumulativo: 0.03,
  irpj_aliquota: 0.15,
  irpj_adicional: 0.10,
  irpj_adicional_limite: 20000,
  csll_aliquota: 0.09,
  pis_nao_cumulativo: 0.0165,
  cofins_nao_cumulativo: 0.076,
  cbs_aliquota: 0.088,
  ibs_aliquota: 0.175,
  reducao_saude: 0.60,
  simples_anexo3_faixas: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.06, deducao: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquota: 0.112, deducao: 9360 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquota: 0.135, deducao: 17640 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquota: 0.16, deducao: 35640 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquota: 0.21, deducao: 125640 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquota: 0.33, deducao: 648000 },
  ],
  simples_anexo5_faixas: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.155, deducao: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquota: 0.18, deducao: 4500 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquota: 0.195, deducao: 9900 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquota: 0.205, deducao: 17100 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquota: 0.23, deducao: 62100 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquota: 0.305, deducao: 540000 },
  ],
};

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  regime_atual: 'SIMPLES',
  iss_aliquota: 0.05,
};

// ==================== FATOR R ALERT FUNCTIONS ====================

export type FatorRStatus = 'ABAIXO' | 'MARGEM' | 'SEGURO';

export interface ProlaboreAdjustment {
  ajusteNecessario: number;
  ajusteMensal: number;
  fatorRAtual: number;
  fatorRProjetado: number;
  status: FatorRStatus;
  folhaAtual: number;
  folhaNecessaria: number;
}

export interface AnexoSavings {
  economiaMensal: number;
  economiaAnual: number;
  aliquotaAnexo3: number;
  aliquotaAnexo5: number;
  impostoAnexo3: number;
  impostoAnexo5: number;
}

/**
 * Calcula o ajuste necessário no pró-labore para atingir o Fator R desejado (28%)
 * 
 * Fórmula:
 * Fator R = Folha12 / RBT12
 * Para Fator R = 0.28:
 *   0.28 = (Folha12 + Ajuste) / RBT12
 *   Ajuste = (0.28 × RBT12) - Folha12
 */
export function calculateProlaboreAdjustment(
  folha12: number,
  rbt12: number,
  targetFatorR: number = 0.28
): ProlaboreAdjustment {
  const fatorRAtual = rbt12 > 0 ? folha12 / rbt12 : 0;
  
  // Folha necessária para atingir target
  const folhaNecessaria = rbt12 * targetFatorR;
  const ajusteNecessario = Math.max(0, folhaNecessaria - folha12);
  const ajusteMensal = ajusteNecessario / 12;
  
  // Determinar status
  let status: FatorRStatus;
  if (fatorRAtual < 0.25) {
    status = 'ABAIXO'; // Muito abaixo, risco alto
  } else if (fatorRAtual < 0.28) {
    status = 'MARGEM'; // Próximo do limite, precisa atenção
  } else {
    status = 'SEGURO'; // Confortável acima de 28%
  }
  
  return {
    ajusteNecessario,
    ajusteMensal,
    fatorRAtual,
    fatorRProjetado: targetFatorR,
    status,
    folhaAtual: folha12,
    folhaNecessaria,
  };
}

/**
 * Calcula a economia ao manter-se no Anexo III vs cair para Anexo V
 */
export function calculateAnexoSavings(
  receitaMensal: number,
  rbt12: number,
  taxParameters: TaxParameters
): AnexoSavings {
  // Calcular alíquota no Anexo III
  const aliquotaAnexo3 = calculateAliquotaEfetivaSimples(rbt12, taxParameters.simples_anexo3_faixas);
  const impostoAnexo3 = receitaMensal * aliquotaAnexo3;
  
  // Calcular alíquota no Anexo V
  const aliquotaAnexo5 = calculateAliquotaEfetivaSimples(rbt12, taxParameters.simples_anexo5_faixas);
  const impostoAnexo5 = receitaMensal * aliquotaAnexo5;
  
  // Economia mensal
  const economiaMensal = impostoAnexo5 - impostoAnexo3;
  const economiaAnual = economiaMensal * 12;
  
  return {
    economiaMensal,
    economiaAnual,
    aliquotaAnexo3,
    aliquotaAnexo5,
    impostoAnexo3,
    impostoAnexo5,
  };
}
