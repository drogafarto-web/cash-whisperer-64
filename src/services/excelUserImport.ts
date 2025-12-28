import * as XLSX from 'xlsx';
import { AppRole } from '@/types/database';

// Mapeamento de normalização de nomes de unidades
const UNIT_NORMALIZATION: Record<string, string> = {
  'Rio Pomba/Riopomba': 'Rio Pomba',
  'Riopomba': 'Rio Pomba',
  'Rio pomba': 'Rio Pomba',
  'rio pomba': 'Rio Pomba',
  'Silverânia': 'Silveirânia',
  'silverânia': 'Silveirânia',
  'silverania': 'Silveirânia',
  'Silverania': 'Silveirânia',
  'Merês': 'Mercês',
  'merês': 'Mercês',
  'Meres': 'Mercês',
  'meres': 'Mercês',
};

// Interface para linha crua da planilha
export interface ExcelRow {
  CPF: string;
  'Nome Completo': string;
  'Data de Nascimento': string | number;
  'E-mail': string;
  Celular: string;
  unidade: string;
  'ID do Grupo': string;
  'Nome Visual': string;
  'Permissões / Petições Permitidas': string;
  senha: string;
}

// Interface para usuário parseado
export interface ParsedUser {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string | null;
  unitName: string;
  groupId: string;
  visualName: string;
  permissions: string;
  password: string;
  role: AppRole;
  isCnpj: boolean;
  hasNoCpf: boolean;
}

// Interface para usuário consolidado (após agrupar por CPF)
export interface ConsolidatedUser extends Omit<ParsedUser, 'unitName'> {
  unitNames: string[];
  primaryUnitName: string;
  isDuplicate: boolean;
  duplicateSource?: string;
}

// Interface para resultado da validação
export interface ValidationResult {
  user: ConsolidatedUser;
  warnings: string[];
  errors: string[];
  status: 'valid' | 'warning' | 'error';
}

// Interface para preview de importação
export interface ImportPreview {
  totalUsers: number;
  newUsers: number;
  updateUsers: number;
  validationResults: ValidationResult[];
  specialCases: {
    duplicateCpfs: ConsolidatedUser[];
    cnpjUsers: ConsolidatedUser[];
    noCpfUsers: ConsolidatedUser[];
  };
}

// Função para mapear grupo → role
export function mapGroupToRole(idGrupo: string, nomeVisual: string): AppRole {
  const grupo = (idGrupo || '').toUpperCase().trim();
  const visual = (nomeVisual || '').toLowerCase().trim();
  
  // Caso admin
  if (grupo === 'ADMIN' || visual.includes('administrador') || grupo === 'TODAS' || visual.includes('todas')) {
    return 'admin';
  }
  
  // Caso contador/fiscal
  if (grupo === 'TAX') {
    return 'contador';
  }
  
  // Caso financeiro
  if (grupo === 'FINANCIAL') {
    return 'financeiro';
  }
  
  // Caso operacional
  if (grupo === 'OPERATIONAL') {
    if (visual.includes('gestor')) {
      return 'gestor_unidade';
    }
    return 'secretaria';
  }
  
  // Default
  return 'secretaria';
}

// Função para normalizar nome de unidade
export function normalizeUnitName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  return UNIT_NORMALIZATION[trimmed] || trimmed;
}

// Função para validar CPF
function isValidCpf(cpf: string): boolean {
  if (!cpf) return false;
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.length === 11;
}

// Função para validar CNPJ
function isValidCnpj(value: string): boolean {
  if (!value) return false;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length === 14;
}

// Função para formatar CPF
export function formatCpf(cpf: string): string {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return cpf;
}

// Função para converter data do Excel
function parseExcelDate(value: string | number | undefined): string | null {
  if (!value) return null;
  
  // Se for número (Excel serial date)
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // Se for string no formato dd/mm/yyyy
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    // Tentar parsear como ISO
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

// Função para parsear arquivo Excel
export async function parseExcelFile(file: File): Promise<ParsedUser[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Procurar aba "Colaboradores"
        const sheetName = workbook.SheetNames.find(
          name => name.toLowerCase().includes('colaboradores')
        ) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
        
        const users: ParsedUser[] = [];
        
        for (const row of jsonData) {
          // Ignorar linhas modelo (sem CPF e sem email)
          const cpf = (row.CPF || '').toString().trim();
          const email = (row['E-mail'] || '').toString().trim();
          
          if (!cpf && !email) continue;
          if (!email) continue; // Precisa ter email para criar usuário
          
          const groupId = (row['ID do Grupo'] || '').toString().trim();
          const visualName = (row['Nome Visual'] || '').toString().trim();
          
          const isCnpj = isValidCnpj(cpf);
          const hasNoCpf = !cpf || (!isValidCpf(cpf) && !isCnpj);
          
          users.push({
            cpf: cpf,
            name: (row['Nome Completo'] || '').toString().trim(),
            email: email.toLowerCase(),
            phone: (row.Celular || '').toString().trim(),
            birthDate: parseExcelDate(row['Data de Nascimento']),
            unitName: normalizeUnitName((row.unidade || '').toString()),
            groupId,
            visualName,
            permissions: (row['Permissões / Petições Permitidas'] || '').toString().trim(),
            password: (row.senha || '123456').toString().trim(),
            role: mapGroupToRole(groupId, visualName),
            isCnpj,
            hasNoCpf,
          });
        }
        
        resolve(users);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
}

// Função para consolidar usuários duplicados por CPF
export function consolidateDuplicates(users: ParsedUser[]): ConsolidatedUser[] {
  const byIdentifier = new Map<string, ParsedUser[]>();
  
  for (const user of users) {
    // Usar CPF como chave se existir, senão usar email
    const key = user.cpf && !user.hasNoCpf 
      ? user.cpf.replace(/\D/g, '') 
      : user.email.toLowerCase();
    
    if (!byIdentifier.has(key)) {
      byIdentifier.set(key, []);
    }
    byIdentifier.get(key)!.push(user);
  }
  
  const consolidated: ConsolidatedUser[] = [];
  
  for (const [_, groupedUsers] of byIdentifier) {
    if (groupedUsers.length === 1) {
      const user = groupedUsers[0];
      consolidated.push({
        ...user,
        unitNames: [user.unitName].filter(Boolean),
        primaryUnitName: user.unitName,
        isDuplicate: false,
      });
    } else {
      // Múltiplas entradas - consolidar
      const primary = groupedUsers[0];
      const allUnits = [...new Set(groupedUsers.map(u => u.unitName).filter(Boolean))];
      
      consolidated.push({
        ...primary,
        unitNames: allUnits,
        primaryUnitName: allUnits[0] || '',
        isDuplicate: true,
        duplicateSource: groupedUsers.map(u => u.unitName).join(', '),
      });
    }
  }
  
  return consolidated;
}

// Função para validar usuários
export function validateUsers(users: ConsolidatedUser[]): ValidationResult[] {
  return users.map(user => {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Verificar email
    if (!user.email || !user.email.includes('@')) {
      errors.push('Email inválido');
    }
    
    // Verificar nome
    if (!user.name || user.name.length < 2) {
      errors.push('Nome muito curto ou ausente');
    }
    
    // Avisos sobre casos especiais
    if (user.hasNoCpf) {
      warnings.push('Usuário sem CPF válido');
    }
    
    if (user.isCnpj) {
      warnings.push('Documento é CNPJ (pessoa jurídica)');
    }
    
    if (user.isDuplicate) {
      warnings.push(`CPF duplicado - vinculado a: ${user.duplicateSource}`);
    }
    
    if (user.password === '123456') {
      warnings.push('Usando senha padrão inicial');
    }
    
    if (!user.unitNames.length) {
      warnings.push('Sem unidade vinculada');
    }
    
    let status: 'valid' | 'warning' | 'error' = 'valid';
    if (errors.length > 0) status = 'error';
    else if (warnings.length > 0) status = 'warning';
    
    return { user, warnings, errors, status };
  });
}

// Função para preparar preview de importação
export function prepareImportPreview(
  users: ConsolidatedUser[], 
  existingEmails: string[],
  existingCpfs: string[]
): ImportPreview {
  const validationResults = validateUsers(users);
  
  const existingEmailsLower = existingEmails.map(e => e.toLowerCase());
  const existingCpfsClean = existingCpfs.map(c => c.replace(/\D/g, ''));
  
  let newUsers = 0;
  let updateUsers = 0;
  
  for (const user of users) {
    const emailExists = existingEmailsLower.includes(user.email.toLowerCase());
    const cpfExists = user.cpf && existingCpfsClean.includes(user.cpf.replace(/\D/g, ''));
    
    if (emailExists || cpfExists) {
      updateUsers++;
    } else {
      newUsers++;
    }
  }
  
  return {
    totalUsers: users.length,
    newUsers,
    updateUsers,
    validationResults,
    specialCases: {
      duplicateCpfs: users.filter(u => u.isDuplicate),
      cnpjUsers: users.filter(u => u.isCnpj),
      noCpfUsers: users.filter(u => u.hasNoCpf),
    },
  };
}
