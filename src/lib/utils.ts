import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Constante de locale para reutilização
export const LOCALE_PTBR = 'pt-BR';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatação de moeda (R$ 1.234,56)
export function formatCurrency(value: number): string {
  return value.toLocaleString(LOCALE_PTBR, { style: 'currency', currency: 'BRL' });
}

// Formatação de moeda nullable
export function formatCurrencyNullable(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return value.toLocaleString(LOCALE_PTBR, { style: 'currency', currency: 'BRL' });
}

// Formatação de moeda com sinal (+R$ 100,00 ou -R$ 100,00)
export function formatCurrencyWithSign(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

// Formatação de número genérico (1.234,56)
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString(LOCALE_PTBR, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Formatação de número compacto (1,5 mil, 2,3 mi)
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE_PTBR, {
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
}

// Formatação de data simples (29/12/2025)
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString(LOCALE_PTBR);
}

// Formatação de data e hora (29/12/2025 14:30:00)
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(LOCALE_PTBR);
}

// Formatação de data longa (domingo, 29 de dezembro de 2025)
export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString(LOCALE_PTBR, { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Formatação de mês e ano (dezembro de 2025)
export function formatMonthYear(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString(LOCALE_PTBR, { month: 'long', year: 'numeric' });
}

// Formatação de hora (14:30)
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(LOCALE_PTBR, { hour: '2-digit', minute: '2-digit' });
}

// Formatação de percentual (28,00%)
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
