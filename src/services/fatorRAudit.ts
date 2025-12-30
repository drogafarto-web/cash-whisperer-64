import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Category } from '@/types/database';

export interface FatorRAuditMonth {
  mes: string;
  mesLabel: string;
  folhaSalarios: number;
  folhaProlabore: number;
  folhaEncargos: number;
  folhaTotal: number;
  folhaNaoFatorR: number;
  receita: number;
  fatorR: number;
  categoriasDetalhadas: {
    categoryId: string;
    categoryName: string;
    entraFatorR: boolean;
    valor: number;
  }[];
}

export interface FatorRAuditResult {
  meses: FatorRAuditMonth[];
  folha12Total: number;
  rbt12: number;
  fatorRMedio: number;
  categoriasNaoMapeadas: string[];
  sugestoes: string[];
}

export interface TransactionWithCategory {
  id: string;
  date: string;
  amount: number;
  type: 'ENTRADA' | 'SAIDA';
  category?: {
    id: string;
    name: string;
    tax_group: string | null;
    entra_fator_r?: boolean;
  } | null;
}

export interface PayableForFatorR {
  id: string;
  vencimento: string;
  valor: number;
  paid_amount?: number | null;
  beneficiario?: string | null;
  status: string;
  matched_transaction_id?: string | null;
  category?: {
    id: string;
    name: string;
    tax_group: string | null;
    entra_fator_r?: boolean;
  } | null;
}

export function auditFatorR(
  transactions: TransactionWithCategory[],
  categories: Category[],
  referenceMonth: string,
  payables?: PayableForFatorR[]
): FatorRAuditResult {
  const endDate = endOfMonth(new Date(referenceMonth + '-01'));
  const startDate = startOfMonth(subMonths(endDate, 11));

  // Inicializar meses
  const monthsMap = new Map<string, FatorRAuditMonth>();
  for (let i = 0; i < 12; i++) {
    const monthDate = subMonths(endDate, 11 - i);
    const monthKey = format(monthDate, 'yyyy-MM');
    monthsMap.set(monthKey, {
      mes: monthKey,
      mesLabel: format(monthDate, 'MMM/yy', { locale: ptBR }),
      folhaSalarios: 0,
      folhaProlabore: 0,
      folhaEncargos: 0,
      folhaTotal: 0,
      folhaNaoFatorR: 0,
      receita: 0,
      fatorR: 0,
      categoriasDetalhadas: [],
    });
  }

  // Criar mapa de categorias para lookup rápido
  const categoriesMap = new Map(categories.map(c => [c.id, c]));
  const categoriasNaoMapeadas = new Set<string>();

  // Processar transações
  transactions.forEach((tx) => {
    const monthKey = format(new Date(tx.date), 'yyyy-MM');
    const monthData = monthsMap.get(monthKey);
    if (!monthData) return;

    const amount = Math.abs(Number(tx.amount));
    const category = tx.category;
    const fullCategory = category?.id ? categoriesMap.get(category.id) : null;
    const taxGroup = category?.tax_group;
    const entraFatorR = fullCategory?.entra_fator_r ?? category?.entra_fator_r ?? false;

    if (tx.type === 'ENTRADA') {
      monthData.receita += amount;
    } else if (taxGroup === 'PESSOAL') {
      // Adicionar aos detalhados
      monthData.categoriasDetalhadas.push({
        categoryId: category?.id || 'unknown',
        categoryName: category?.name || 'Desconhecida',
        entraFatorR,
        valor: amount,
      });

      if (entraFatorR) {
        const catName = category?.name?.toLowerCase() || '';
        
        if (catName.includes('pró-labore') || catName.includes('pro-labore')) {
          monthData.folhaProlabore += amount;
        } else if (
          catName.includes('inss') || 
          catName.includes('fgts') || 
          catName.includes('encargo') ||
          catName.includes('patronal')
        ) {
          monthData.folhaEncargos += amount;
        } else {
          // Salários, 13º, Férias
          monthData.folhaSalarios += amount;
        }
        monthData.folhaTotal += amount;
      } else {
        monthData.folhaNaoFatorR += amount;
      }

      // Verificar categorias não mapeadas (PESSOAL sem flag definido)
      if (fullCategory && fullCategory.entra_fator_r === null) {
        categoriasNaoMapeadas.add(category?.name || 'Desconhecida');
      }
    }
  });

  // Processar payables pagos (folha, impostos, etc.)
  // Evitar duplicidade: só incluir payables que NÃO têm matched_transaction_id
  if (payables) {
    payables.forEach((payable) => {
      // Se o payable já está vinculado a uma transaction, pular para evitar duplicidade
      if (payable.matched_transaction_id) return;
      
      // Só processar pagos
      if (!['pago', 'PAGO'].includes(payable.status)) return;
      
      const dateValue = payable.vencimento;
      if (!dateValue) return;
      
      const monthKey = format(new Date(dateValue), 'yyyy-MM');
      const monthData = monthsMap.get(monthKey);
      if (!monthData) return;
      
      const amount = Math.abs(Number(payable.paid_amount || payable.valor || 0));
      const category = payable.category;
      const fullCategory = category?.id ? categoriesMap.get(category.id) : null;
      const taxGroup = category?.tax_group;
      const entraFatorR = fullCategory?.entra_fator_r ?? category?.entra_fator_r ?? false;
      
      // Só processar despesas de PESSOAL
      if (taxGroup === 'PESSOAL') {
        monthData.categoriasDetalhadas.push({
          categoryId: category?.id || 'unknown',
          categoryName: category?.name || payable.beneficiario || 'Desconhecida',
          entraFatorR,
          valor: amount,
        });
        
        if (entraFatorR) {
          const catName = category?.name?.toLowerCase() || '';
          const beneficiario = (payable.beneficiario || '').toLowerCase();
          
          if (catName.includes('pró-labore') || catName.includes('pro-labore') ||
              beneficiario.includes('prolabore') || beneficiario.includes('pró-labore')) {
            monthData.folhaProlabore += amount;
          } else if (
            catName.includes('inss') || catName.includes('fgts') || 
            catName.includes('encargo') || catName.includes('patronal') ||
            beneficiario.includes('inss') || beneficiario.includes('fgts') || beneficiario.includes('gps')
          ) {
            monthData.folhaEncargos += amount;
          } else {
            monthData.folhaSalarios += amount;
          }
          monthData.folhaTotal += amount;
        } else {
          monthData.folhaNaoFatorR += amount;
        }
        
        if (fullCategory && fullCategory.entra_fator_r === null) {
          categoriasNaoMapeadas.add(category?.name || payable.beneficiario || 'Desconhecida');
        }
      }
    });
  }

  // Calcular totais
  const meses = Array.from(monthsMap.values());
  let folha12Total = 0;
  let rbt12 = 0;

  meses.forEach((m) => {
    folha12Total += m.folhaTotal;
    rbt12 += m.receita;
    m.fatorR = m.receita > 0 ? m.folhaTotal / m.receita : 0;
  });

  const fatorRMedio = rbt12 > 0 ? folha12Total / rbt12 : 0;

  // Gerar sugestões
  const sugestoes: string[] = [];
  
  if (fatorRMedio < 0.28) {
    const necessario = rbt12 * 0.28;
    const falta = necessario - folha12Total;
    sugestoes.push(
      `Para atingir 28%, seria necessário adicionar R$ ${falta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em folha nos últimos 12 meses (≈ R$ ${(falta / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês em pró-labore).`
    );
  }

  if (categoriasNaoMapeadas.size > 0) {
    sugestoes.push(
      `Existem ${categoriasNaoMapeadas.size} categoria(s) de PESSOAL sem marcação "Entra no Fator R". Verifique e marque as categorias corretas.`
    );
  }

  const mesesSemDados = meses.filter(m => m.receita === 0).length;
  if (mesesSemDados > 0) {
    sugestoes.push(
      `${mesesSemDados} mês(es) sem dados de receita. Isso pode afetar o cálculo do RBT12 e Fator R.`
    );
  }

  return {
    meses,
    folha12Total,
    rbt12,
    fatorRMedio,
    categoriasNaoMapeadas: Array.from(categoriasNaoMapeadas),
    sugestoes,
  };
}

export function getCategoriasFatorR(): string[] {
  return [
    'Salários',
    'Pró-labore',
    '13º Salário',
    'Férias',
    'INSS Patronal',
    'FGTS',
  ];
}

export function getCategoriasBeneficios(): string[] {
  return [
    'Vale Transporte',
    'Vale Alimentação',
    'Plano de Saúde Funcionários',
    'Adiantamento Salarial',
    'Distribuição de Lucros',
  ];
}
