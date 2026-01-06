// Formatos de data padrão para uso com date-fns format()
export const DATE_FORMATS = {
  // Data simples: 29/12/2025
  short: 'dd/MM/yyyy',
  
  // Data com hora: 29/12/2025 14:30
  dateTime: 'dd/MM/yyyy HH:mm',
  
  // Data por extenso: 29 de dezembro de 2025
  long: "dd 'de' MMMM 'de' yyyy",
  
  // Mês e ano: dezembro de 2025
  monthYear: "MMMM 'de' yyyy",
  
  // Dia da semana: segunda-feira, 29 de dezembro
  weekday: "EEEE, dd 'de' MMMM",
  
  // Apenas hora: 14:30
  time: 'HH:mm',
  
  // Para nomes de arquivo: 2025-12-29
  iso: 'yyyy-MM-dd',
  
  // Mês abreviado: 29 dez 2025
  shortMonth: "dd MMM yyyy",
} as const;

// Tipo para os formatos disponíveis
export type DateFormatKey = keyof typeof DATE_FORMATS;

// Formata valor para moeda brasileira
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Normaliza nome de fornecedor para relatórios
export function normalizeFornecedor(nome: string, maxLength = 40): string {
  if (!nome) return 'Sem Fornecedor';
  
  let normalized = nome
    .replace(/\s*-\s*/g, ' ') // "DB - " -> "DB "
    .replace(/\s+LTDA\.?$/gi, '')
    .replace(/\s+ME$/gi, '')
    .replace(/\s+EPP$/gi, '')
    .replace(/\s+EIRELI$/gi, '')
    .replace(/\s+S\.?A\.?$/gi, '')
    .replace(/\s+SOCIEDADE\s+SIMPLES$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalizar adequadamente (Title Case)
  normalized = normalized
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Palavras que devem permanecer minúsculas
      if (['de', 'da', 'do', 'das', 'dos', 'e', 'em'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  // Primeira letra sempre maiúscula
  normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  
  // Truncar se muito longo
  if (normalized.length > maxLength) {
    normalized = normalized.substring(0, maxLength - 3) + '...';
  }
  
  return normalized;
}
