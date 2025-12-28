/**
 * Serviço de validação de consistência para dados contábeis
 * Fornece sugestões inteligentes e detecta anomalias
 */

export interface TaxGuideOcrResult {
  tipo_documento: 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'folha' | 'outro';
  valor: number | null;
  vencimento: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  cnpj_contribuinte: string | null;
  competencia: { ano: number; mes: number } | null;
  beneficiario: string | null;
  sugestao: string | null;
  alertas: string[];
  confidence: number;
  raw_text?: string;
}

export interface PayrollOcrResult {
  total_folha: number | null;
  encargos: number | null;
  prolabore: number | null;
  num_funcionarios: number | null;
  competencia: { ano: number; mes: number } | null;
  sugestao: string | null;
  alertas: string[];
  confidence: number;
}

export interface ConsistencyCheck {
  id: string;
  field: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  expected?: number;
  actual?: number;
}

export interface HistoricalData {
  ano: number;
  mes: number;
  total_folha: number;
  receita_servicos: number;
  das_valor: number;
  fgts_valor: number;
  inss_valor: number;
}

const TAX_TYPE_LABELS: Record<string, string> = {
  das: 'DAS (Simples Nacional)',
  darf: 'DARF',
  gps: 'GPS',
  inss: 'INSS',
  fgts: 'FGTS',
  iss: 'ISS',
  folha: 'Folha de Pagamento',
};

/**
 * Valida consistência entre DAS e faturamento
 * DAS do Simples Nacional geralmente é entre 4% e 19% do faturamento
 */
export function validateDasVsFaturamento(
  dasValor: number,
  faturamento: number
): ConsistencyCheck {
  if (faturamento === 0) {
    return {
      id: 'das-faturamento',
      field: 'das_valor',
      label: 'DAS vs Faturamento',
      status: dasValor > 0 ? 'warning' : 'ok',
      message: dasValor > 0 
        ? 'DAS informado mas faturamento é zero. Verifique os dados de receita.' 
        : 'Sem faturamento informado para comparar.',
    };
  }

  const percentual = (dasValor / faturamento) * 100;
  
  if (percentual < 4 || percentual > 19) {
    return {
      id: 'das-faturamento',
      field: 'das_valor',
      label: 'DAS vs Faturamento',
      status: 'warning',
      message: `DAS representa ${percentual.toFixed(1)}% do faturamento. O esperado é entre 4% e 19% (Simples Nacional).`,
      expected: faturamento * 0.08, // 8% como média
      actual: dasValor,
    };
  }

  return {
    id: 'das-faturamento',
    field: 'das_valor',
    label: 'DAS vs Faturamento',
    status: 'ok',
    message: `DAS de ${percentual.toFixed(1)}% do faturamento está dentro do esperado.`,
  };
}

/**
 * Valida consistência entre FGTS e folha de pagamento
 * FGTS é 8% do salário bruto
 */
export function validateFgtsVsFolha(
  fgtsValor: number,
  totalFolha: number
): ConsistencyCheck {
  if (totalFolha === 0) {
    return {
      id: 'fgts-folha',
      field: 'fgts_valor',
      label: 'FGTS vs Folha',
      status: fgtsValor > 0 ? 'warning' : 'ok',
      message: fgtsValor > 0 
        ? 'FGTS informado mas folha é zero. Verifique os dados.' 
        : 'Sem folha informada para comparar.',
    };
  }

  const expectedFgts = totalFolha * 0.08;
  const tolerance = expectedFgts * 0.15; // 15% de tolerância

  if (Math.abs(fgtsValor - expectedFgts) > tolerance) {
    const percentual = ((fgtsValor / totalFolha) * 100).toFixed(1);
    return {
      id: 'fgts-folha',
      field: 'fgts_valor',
      label: 'FGTS vs Folha',
      status: 'warning',
      message: `FGTS de ${percentual}% da folha (esperado: 8%). Verificar se há afastamentos ou rescisões.`,
      expected: expectedFgts,
      actual: fgtsValor,
    };
  }

  return {
    id: 'fgts-folha',
    field: 'fgts_valor',
    label: 'FGTS vs Folha',
    status: 'ok',
    message: `FGTS de 8% da folha está correto.`,
  };
}

/**
 * Valida consistência entre INSS e folha de pagamento
 * INSS patronal varia entre 20% e 28,8% da folha
 */
export function validateInssVsFolha(
  inssValor: number,
  totalFolha: number,
  isSimples: boolean = true
): ConsistencyCheck {
  if (totalFolha === 0) {
    return {
      id: 'inss-folha',
      field: 'inss_valor',
      label: 'INSS vs Folha',
      status: inssValor > 0 ? 'warning' : 'ok',
      message: inssValor > 0 
        ? 'INSS informado mas folha é zero.' 
        : 'Sem folha informada para comparar.',
    };
  }

  // Para Simples Nacional, INSS já está incluso no DAS
  if (isSimples && inssValor > 0) {
    return {
      id: 'inss-folha',
      field: 'inss_valor',
      label: 'INSS vs Folha',
      status: 'warning',
      message: 'Empresa no Simples Nacional geralmente não paga INSS separado. Verificar regime tributário.',
    };
  }

  const percentual = (inssValor / totalFolha) * 100;
  
  if (percentual > 30) {
    return {
      id: 'inss-folha',
      field: 'inss_valor',
      label: 'INSS vs Folha',
      status: 'warning',
      message: `INSS de ${percentual.toFixed(1)}% da folha parece alto. Esperado: até 28,8%.`,
      expected: totalFolha * 0.25,
      actual: inssValor,
    };
  }

  return {
    id: 'inss-folha',
    field: 'inss_valor',
    label: 'INSS vs Folha',
    status: 'ok',
    message: `INSS de ${percentual.toFixed(1)}% da folha está dentro do esperado.`,
  };
}

/**
 * Valida se o pró-labore está dentro do limite
 */
export function validateProlabore(
  prolabore: number,
  faturamento: number
): ConsistencyCheck {
  const salarioMinimo = 1518; // 2025
  
  if (prolabore > 0 && prolabore < salarioMinimo) {
    return {
      id: 'prolabore-minimo',
      field: 'prolabore',
      label: 'Pró-labore',
      status: 'warning',
      message: `Pró-labore de R$ ${prolabore.toLocaleString('pt-BR')} está abaixo do salário mínimo (R$ ${salarioMinimo.toLocaleString('pt-BR')}).`,
    };
  }

  // Limite de deducibilidade para IR
  const tetoProlabore = 50000;
  if (prolabore > tetoProlabore) {
    return {
      id: 'prolabore-alto',
      field: 'prolabore',
      label: 'Pró-labore',
      status: 'warning',
      message: `Pró-labore de R$ ${prolabore.toLocaleString('pt-BR')} é alto. Considere otimização tributária.`,
    };
  }

  return {
    id: 'prolabore',
    field: 'prolabore',
    label: 'Pró-labore',
    status: 'ok',
    message: `Pró-labore de R$ ${prolabore.toLocaleString('pt-BR')} está adequado.`,
  };
}

/**
 * Compara com mês anterior para detectar anomalias
 */
export function compareWithPreviousMonth(
  current: { valor: number; label: string },
  previous: number | null,
  field: string
): ConsistencyCheck | null {
  if (previous === null || previous === 0) {
    return null;
  }

  const variacao = ((current.valor - previous) / previous) * 100;
  
  if (Math.abs(variacao) > 30) {
    return {
      id: `variacao-${field}`,
      field,
      label: `Variação ${current.label}`,
      status: 'warning',
      message: `${current.label} ${variacao > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(variacao).toFixed(0)}% em relação ao mês anterior. Verificar se está correto.`,
      expected: previous,
      actual: current.valor,
    };
  }

  return null;
}

/**
 * Verifica se vencimento já passou
 */
export function checkDueDate(
  vencimento: string | null,
  tipoGuia: string
): ConsistencyCheck | null {
  if (!vencimento) return null;

  const today = new Date();
  const dueDate = new Date(vencimento);
  
  if (dueDate < today) {
    const diasAtraso = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: `vencimento-${tipoGuia}`,
      field: `${tipoGuia}_vencimento`,
      label: `Vencimento ${TAX_TYPE_LABELS[tipoGuia] || tipoGuia.toUpperCase()}`,
      status: 'error',
      message: `Vencimento em ${new Date(vencimento).toLocaleDateString('pt-BR')} já passou (${diasAtraso} dias de atraso). Verificar multa/juros.`,
    };
  }

  return null;
}

/**
 * Executa todas as validações de consistência
 */
export function runAllValidations(data: {
  das_valor: number;
  darf_valor: number;
  gps_valor: number;
  inss_valor: number;
  fgts_valor: number;
  iss_valor: number;
  das_vencimento: string | null;
  darf_vencimento: string | null;
  gps_vencimento: string | null;
  inss_vencimento: string | null;
  fgts_vencimento: string | null;
  iss_vencimento: string | null;
  total_folha: number;
  prolabore: number;
  receita_servicos: number;
  receita_outras: number;
}, previousMonth?: HistoricalData | null): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = [];
  const faturamento = data.receita_servicos + data.receita_outras;

  // Validações de proporção
  checks.push(validateDasVsFaturamento(data.das_valor, faturamento));
  checks.push(validateFgtsVsFolha(data.fgts_valor, data.total_folha));
  checks.push(validateInssVsFolha(data.inss_valor, data.total_folha));
  checks.push(validateProlabore(data.prolabore, faturamento));

  // Validações de vencimento
  const dueDateChecks = [
    checkDueDate(data.das_vencimento, 'das'),
    checkDueDate(data.darf_vencimento, 'darf'),
    checkDueDate(data.gps_vencimento, 'gps'),
    checkDueDate(data.inss_vencimento, 'inss'),
    checkDueDate(data.fgts_vencimento, 'fgts'),
    checkDueDate(data.iss_vencimento, 'iss'),
  ].filter((c): c is ConsistencyCheck => c !== null);
  checks.push(...dueDateChecks);

  // Comparação com mês anterior
  if (previousMonth) {
    const monthComparisons = [
      compareWithPreviousMonth(
        { valor: data.das_valor, label: 'DAS' },
        previousMonth.das_valor,
        'das_valor'
      ),
      compareWithPreviousMonth(
        { valor: data.total_folha, label: 'Folha' },
        previousMonth.total_folha,
        'total_folha'
      ),
      compareWithPreviousMonth(
        { valor: faturamento, label: 'Faturamento' },
        previousMonth.receita_servicos,
        'receita_servicos'
      ),
    ].filter((c): c is ConsistencyCheck => c !== null);
    checks.push(...monthComparisons);
  }

  return checks;
}

/**
 * Gera sugestão contextual baseada nos dados
 */
export function generateContextualSuggestion(
  tipoDocumento: string,
  valor: number,
  competencia: { ano: number; mes: number },
  previousValue?: number | null
): string {
  const label = TAX_TYPE_LABELS[tipoDocumento] || tipoDocumento.toUpperCase();
  const mesLabel = new Date(competencia.ano, competencia.mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  let sugestao = `${label} de ${mesLabel} no valor de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
  
  if (previousValue && previousValue > 0) {
    const variacao = ((valor - previousValue) / previousValue) * 100;
    if (Math.abs(variacao) > 10) {
      sugestao += ` ${variacao > 0 ? 'Aumento' : 'Redução'} de ${Math.abs(variacao).toFixed(1)}% em relação ao mês anterior.`;
      if (Math.abs(variacao) > 25) {
        sugestao += ' Verificar se está correto.';
      }
    } else {
      sugestao += ' Valor consistente com mês anterior.';
    }
  }
  
  return sugestao;
}

/**
 * Gera alertas baseados na análise do documento
 */
export function generateAlerts(
  tipoDocumento: string,
  valor: number,
  vencimento: string | null,
  competencia: { ano: number; mes: number },
  expectedCompetencia: { ano: number; mes: number }
): string[] {
  const alertas: string[] = [];
  
  // Verificar competência
  if (competencia.ano !== expectedCompetencia.ano || competencia.mes !== expectedCompetencia.mes) {
    alertas.push(`Competência do documento (${competencia.mes}/${competencia.ano}) difere da competência selecionada (${expectedCompetencia.mes}/${expectedCompetencia.ano}).`);
  }
  
  // Verificar vencimento
  if (vencimento) {
    const today = new Date();
    const dueDate = new Date(vencimento);
    
    if (dueDate < today) {
      const diasAtraso = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      alertas.push(`Vencimento já passou há ${diasAtraso} dia(s). Verificar multa/juros.`);
    } else {
      const diasRestantes = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diasRestantes <= 3) {
        alertas.push(`Vence em ${diasRestantes} dia(s). Pagar com urgência.`);
      }
    }
  }
  
  // Verificar valor zerado
  if (valor === 0) {
    alertas.push('Valor zerado detectado. Verificar se está correto.');
  }
  
  return alertas;
}
