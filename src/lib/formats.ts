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
