/**
 * Serviço de Simulação de Regularização de Pagamentos Informais
 * 
 * IMPORTANTE: Esta ferramenta é apenas para DIAGNÓSTICO e PLANEJAMENTO
 * de regularização. Não incentiva a manutenção de práticas informais.
 * 
 * Toda decisão de regularização deve ser validada com contador e advogado trabalhista.
 */

import { RegularizationSimulation } from '@/types/database';
import {
  calculateFatorR,
  calculateAliquotaEfetivaSimples,
  TaxParameters,
  DEFAULT_TAX_PARAMETERS,
} from './taxSimulator';

export interface RegularizationInput {
  folhaOficial12: number;      // Soma da folha oficial dos últimos 12 meses
  pagamentosInformais12: number; // Soma dos pagamentos informais dos últimos 12 meses
  rbt12: number;               // Receita bruta total dos últimos 12 meses
  taxParameters: TaxParameters;
  receitaMensal: number;       // Receita do mês atual (para cálculo de economia)
}

export interface RegularizationResult extends RegularizationSimulation {
  anexoAtual: 'III' | 'V';
  anexoSimulado: 'III' | 'V';
  aliquotaAtual: number;
  aliquotaSimulada: number;
  roiRegularizacao: number; // ROI: economiaImposto / custoAdicionalEncargos
  paybackMeses: number;
}

/**
 * Calcula os encargos adicionais ao regularizar pagamentos informais
 * 
 * Premissas conservadoras:
 * - INSS Patronal: 20%
 * - FGTS: 8%
 * - Provisão 13º: 8.33%
 * - Provisão Férias + 1/3: 11.11%
 * - Outros encargos (RAT, Sistema S): ~3%
 * 
 * Total aproximado: ~50% sobre o valor regularizado
 */
const TAXA_ENCARGOS_REGULARIZACAO = 0.50;

/**
 * Simula cenários de regularização de pagamentos informais
 * 
 * @param input - Dados financeiros atuais
 * @param percentualRegularizacao - 0 a 100, quanto do informal será regularizado
 * @returns Resultado da simulação com economia/custo
 */
export function simulateRegularization(
  input: RegularizationInput,
  percentualRegularizacao: number
): RegularizationResult {
  const {
    folhaOficial12,
    pagamentosInformais12,
    rbt12,
    taxParameters,
    receitaMensal,
  } = input;

  const percentual = Math.max(0, Math.min(100, percentualRegularizacao)) / 100;
  
  // Valor a ser regularizado (anual)
  const valorRegularizado = pagamentosInformais12 * percentual;
  
  // Custo adicional de encargos (anual)
  const custoAdicionalEncargos = valorRegularizado * TAXA_ENCARGOS_REGULARIZACAO;
  
  // Nova folha simulada (12 meses)
  const folhaSimulada12 = folhaOficial12 + valorRegularizado;
  
  // Calcular Fator R atual e simulado
  const fatorRAtual = calculateFatorR(folhaOficial12, rbt12);
  const fatorRSimulado = calculateFatorR(folhaSimulada12, rbt12);
  
  // Determinar anexos
  const anexoAtual: 'III' | 'V' = fatorRAtual >= 0.28 ? 'III' : 'V';
  const anexoSimulado: 'III' | 'V' = fatorRSimulado >= 0.28 ? 'III' : 'V';
  
  // Calcular alíquotas
  const faixasAtual = anexoAtual === 'III' 
    ? taxParameters.simples_anexo3_faixas 
    : taxParameters.simples_anexo5_faixas;
  const faixasSimulado = anexoSimulado === 'III' 
    ? taxParameters.simples_anexo3_faixas 
    : taxParameters.simples_anexo5_faixas;
  
  const aliquotaAtual = calculateAliquotaEfetivaSimples(rbt12, faixasAtual);
  const aliquotaSimulada = calculateAliquotaEfetivaSimples(rbt12, faixasSimulado);
  
  // Economia no imposto (mensal e anual)
  const impostoAtualMensal = receitaMensal * aliquotaAtual;
  const impostoSimuladoMensal = receitaMensal * aliquotaSimulada;
  const economiaImpostoMensal = impostoAtualMensal - impostoSimuladoMensal;
  const economiaImpostoAnual = economiaImpostoMensal * 12;
  
  // Resultado líquido anual (economia - custo adicional)
  const resultadoLiquido = economiaImpostoAnual - custoAdicionalEncargos;
  
  // ROI: quanto economiza para cada real gasto em encargos
  const roiRegularizacao = custoAdicionalEncargos > 0 
    ? economiaImpostoAnual / custoAdicionalEncargos 
    : 0;
  
  // Payback em meses (quanto tempo para recuperar o custo adicional)
  const paybackMeses = economiaImpostoMensal > 0 
    ? custoAdicionalEncargos / economiaImpostoMensal 
    : Infinity;
  
  return {
    percentualRegularizacao,
    folhaOficial: folhaOficial12,
    pagamentosInformais: pagamentosInformais12,
    folhaSimulada: folhaSimulada12,
    fatorRAtual,
    fatorRSimulado,
    custoAdicionalEncargos,
    economiaImposto: economiaImpostoAnual,
    resultadoLiquido,
    anexoAtual,
    anexoSimulado,
    aliquotaAtual,
    aliquotaSimulada,
    roiRegularizacao,
    paybackMeses,
  };
}

/**
 * Encontra o percentual ótimo de regularização
 * (aquele que maximiza o resultado líquido)
 */
export function findOptimalRegularization(
  input: RegularizationInput,
  step: number = 10
): { percentual: number; resultado: RegularizationResult } {
  let melhorPercentual = 0;
  let melhorResultado = simulateRegularization(input, 0);
  
  for (let p = step; p <= 100; p += step) {
    const resultado = simulateRegularization(input, p);
    
    // Só considera vantajoso se passar para Anexo III ou melhorar resultado
    if (resultado.resultadoLiquido > melhorResultado.resultadoLiquido) {
      melhorPercentual = p;
      melhorResultado = resultado;
    }
  }
  
  return { percentual: melhorPercentual, resultado: melhorResultado };
}

/**
 * Gera diagnósticos sobre a regularização
 */
export function generateRegularizationDiagnostics(
  result: RegularizationResult
): string[] {
  const diagnosticos: string[] = [];
  
  // Mudança de anexo
  if (result.anexoAtual === 'V' && result.anexoSimulado === 'III') {
    diagnosticos.push(
      `✅ A regularização de ${result.percentualRegularizacao}% permitiria migrar do Anexo V para o Anexo III, ` +
      `com economia anual estimada de R$ ${result.economiaImposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
    );
  }
  
  // Resultado líquido
  if (result.resultadoLiquido > 0) {
    diagnosticos.push(
      `💰 Resultado líquido positivo: economia de R$ ${result.resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ` +
      `por ano após considerar o custo adicional de encargos.`
    );
  } else if (result.resultadoLiquido < 0 && result.percentualRegularizacao > 0) {
    diagnosticos.push(
      `⚠️ A regularização tem custo líquido negativo (R$ ${Math.abs(result.resultadoLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por ano), ` +
      `mas elimina riscos trabalhistas e fiscais.`
    );
  }
  
  // ROI
  if (result.roiRegularizacao >= 1) {
    diagnosticos.push(
      `📈 ROI de ${(result.roiRegularizacao * 100).toFixed(0)}%: cada R$ 1 em encargos gera ` +
      `R$ ${result.roiRegularizacao.toFixed(2)} de economia tributária.`
    );
  }
  
  // Payback
  if (result.paybackMeses < 12 && result.paybackMeses !== Infinity) {
    diagnosticos.push(
      `⏱️ Payback em ${result.paybackMeses.toFixed(1)} meses: ` +
      `o custo adicional de encargos se paga com a economia tributária.`
    );
  }
  
  // Alerta de risco
  if (result.percentualRegularizacao === 0 && result.pagamentosInformais > 0) {
    diagnosticos.push(
      `🚨 ATENÇÃO: R$ ${result.pagamentosInformais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em pagamentos informais ` +
      `representam risco trabalhista (passivo oculto) e fiscal. Consulte seu contador e advogado.`
    );
  }
  
  return diagnosticos;
}
