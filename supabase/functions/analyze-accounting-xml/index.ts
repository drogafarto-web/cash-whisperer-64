import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CNPJs conhecidos do LabClin (normalizados - apenas números)
const LABCLIN_CNPJS = [
  '03047218000190', // Matriz Rio Pomba
  '03047218000270', // Mercês
  '60239141000193', // Silveirânia
];

function normalizeCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

function isLabClinCnpj(cnpj: string | null | undefined): boolean {
  const normalized = normalizeCnpj(cnpj);
  return LABCLIN_CNPJS.includes(normalized);
}

// Extrai valor de um nó XML usando regex (simples e eficiente para Deno)
function extractXmlValue(xml: string, tagName: string): string | null {
  // Tenta com namespace e sem
  const patterns = [
    new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i'),
    new RegExp(`<\\w+:${tagName}>([^<]*)</\\w+:${tagName}>`, 'i'),
    new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Extrai bloco XML
function extractXmlBlock(xml: string, tagName: string): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
    new RegExp(`<\\w+:${tagName}[^>]*>([\\s\\S]*?)</\\w+:${tagName}>`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

interface ParsedNfe {
  type: 'nfe' | 'nfse' | 'unknown';
  emitCnpj?: string;
  emitNome?: string;
  destCnpj?: string;
  destNome?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotal?: number;
  valorServicos?: number;
  iss?: number;
  pis?: number;
  cofins?: number;
  inss?: number;
  codigoVerificacao?: string;
  descricao?: string;
}

// Parse NF-e padrão SEFAZ
function parseNfe(xml: string): ParsedNfe | null {
  const infNFe = extractXmlBlock(xml, 'infNFe') || extractXmlBlock(xml, 'NFe');
  if (!infNFe) return null;
  
  const emit = extractXmlBlock(infNFe, 'emit');
  const dest = extractXmlBlock(infNFe, 'dest');
  const ide = extractXmlBlock(infNFe, 'ide');
  const total = extractXmlBlock(infNFe, 'total') || extractXmlBlock(infNFe, 'ICMSTot');
  
  const emitCnpj = emit ? (extractXmlValue(emit, 'CNPJ') || extractXmlValue(emit, 'CPF')) : null;
  const emitNome = emit ? (extractXmlValue(emit, 'xNome') || extractXmlValue(emit, 'xFant')) : null;
  const destCnpj = dest ? (extractXmlValue(dest, 'CNPJ') || extractXmlValue(dest, 'CPF')) : null;
  const destNome = dest ? extractXmlValue(dest, 'xNome') : null;
  
  const numero = ide ? extractXmlValue(ide, 'nNF') : null;
  const serie = ide ? extractXmlValue(ide, 'serie') : null;
  const dataEmissao = ide ? (extractXmlValue(ide, 'dhEmi') || extractXmlValue(ide, 'dEmi')) : null;
  
  const valorTotal = total ? parseFloat(extractXmlValue(total, 'vNF') || extractXmlValue(total, 'vProd') || '0') : 0;
  const pis = total ? parseFloat(extractXmlValue(total, 'vPIS') || '0') : 0;
  const cofins = total ? parseFloat(extractXmlValue(total, 'vCOFINS') || '0') : 0;
  
  if (!emitCnpj && !destCnpj) return null;
  
  return {
    type: 'nfe',
    emitCnpj: emitCnpj || undefined,
    emitNome: emitNome || undefined,
    destCnpj: destCnpj || undefined,
    destNome: destNome || undefined,
    numero: numero || undefined,
    serie: serie || undefined,
    dataEmissao: dataEmissao || undefined,
    valorTotal,
    pis,
    cofins,
  };
}

// Parse NFS-e padrão ABRASF
function parseNfse(xml: string): ParsedNfe | null {
  // Tenta encontrar blocos de NFS-e
  const nfse = extractXmlBlock(xml, 'Nfse') || 
               extractXmlBlock(xml, 'CompNfse') || 
               extractXmlBlock(xml, 'tcCompNfse') ||
               extractXmlBlock(xml, 'InfNfse') ||
               xml;
  
  const prestador = extractXmlBlock(nfse, 'Prestador') || 
                    extractXmlBlock(nfse, 'PrestadorServico') ||
                    extractXmlBlock(nfse, 'IdentificacaoPrestador');
  const tomador = extractXmlBlock(nfse, 'Tomador') || 
                  extractXmlBlock(nfse, 'TomadorServico');
  const valores = extractXmlBlock(nfse, 'Valores') || 
                  extractXmlBlock(nfse, 'ValoresNfse') ||
                  extractXmlBlock(nfse, 'Servico');
  const identificacao = extractXmlBlock(nfse, 'IdentificacaoNfse') ||
                        extractXmlBlock(nfse, 'InfNfse');
  
  // CNPJ do prestador
  let prestadorCnpj = null;
  if (prestador) {
    prestadorCnpj = extractXmlValue(prestador, 'Cnpj') || 
                    extractXmlValue(prestador, 'CpfCnpj') ||
                    extractXmlValue(extractXmlBlock(prestador, 'CpfCnpj') || '', 'Cnpj');
  }
  
  const prestadorNome = prestador ? (
    extractXmlValue(prestador, 'RazaoSocial') || 
    extractXmlValue(prestador, 'NomeFantasia')
  ) : null;
  
  // CNPJ do tomador
  let tomadorCnpj = null;
  if (tomador) {
    const cpfCnpjBlock = extractXmlBlock(tomador, 'CpfCnpj') || 
                         extractXmlBlock(tomador, 'IdentificacaoTomador') ||
                         tomador;
    tomadorCnpj = extractXmlValue(cpfCnpjBlock, 'Cnpj') || 
                  extractXmlValue(cpfCnpjBlock, 'Cpf') ||
                  extractXmlValue(tomador, 'Cnpj');
  }
  
  const tomadorNome = tomador ? (
    extractXmlValue(tomador, 'RazaoSocial') || 
    extractXmlValue(tomador, 'NomeFantasia')
  ) : null;
  
  // Número da NFS-e
  const numero = extractXmlValue(identificacao || nfse, 'Numero') ||
                 extractXmlValue(nfse, 'NumeroNfse');
  
  // Data de emissão
  const dataEmissao = extractXmlValue(nfse, 'DataEmissao') ||
                      extractXmlValue(nfse, 'DataEmissaoNfse') ||
                      extractXmlValue(identificacao || nfse, 'DataEmissao');
  
  // Código de verificação
  const codigoVerificacao = extractXmlValue(nfse, 'CodigoVerificacao') ||
                            extractXmlValue(identificacao || nfse, 'CodigoVerificacao');
  
  // Valores
  const valorServicos = valores ? parseFloat(
    extractXmlValue(valores, 'ValorServicos') || 
    extractXmlValue(valores, 'ValorLiquidoNfse') ||
    extractXmlValue(valores, 'BaseCalculo') ||
    '0'
  ) : 0;
  
  const iss = valores ? parseFloat(extractXmlValue(valores, 'ValorIss') || extractXmlValue(valores, 'ValorIssRetido') || '0') : 0;
  const inss = valores ? parseFloat(extractXmlValue(valores, 'ValorInss') || '0') : 0;
  const pis = valores ? parseFloat(extractXmlValue(valores, 'ValorPis') || '0') : 0;
  const cofins = valores ? parseFloat(extractXmlValue(valores, 'ValorCofins') || '0') : 0;
  
  // Descrição do serviço
  const servico = extractXmlBlock(nfse, 'Servico') || extractXmlBlock(nfse, 'DeclaracaoServico');
  const descricao = servico ? extractXmlValue(servico, 'Discriminacao') : null;
  
  if (!prestadorCnpj && !tomadorCnpj) return null;
  
  return {
    type: 'nfse',
    emitCnpj: prestadorCnpj || undefined,
    emitNome: prestadorNome || undefined,
    destCnpj: tomadorCnpj || undefined,
    destNome: tomadorNome || undefined,
    numero: numero || undefined,
    dataEmissao: dataEmissao || undefined,
    valorTotal: valorServicos,
    valorServicos,
    iss,
    inss,
    pis,
    cofins,
    codigoVerificacao: codigoVerificacao || undefined,
    descricao: descricao || undefined,
  };
}

// Formata data ISO para yyyy-MM-dd
function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  // Tenta extrair data de formatos comuns
  // ISO: 2025-12-15T10:30:00-03:00
  // Simples: 2025-12-15
  // BR: 15/12/2025
  
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { xml, unitId } = await req.json();
    
    if (!xml) {
      return new Response(
        JSON.stringify({ error: 'XML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-accounting-xml] Processing XML for unit ${unitId}`);
    console.log(`[analyze-accounting-xml] XML length: ${xml.length} characters`);

    // Buscar CNPJs adicionais das unidades no banco (opcional, complementa a lista fixa)
    let additionalCnpjs: string[] = [];
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: units } = await supabase
        .from('units')
        .select('cnpj')
        .not('cnpj', 'is', null);
      
      if (units) {
        additionalCnpjs = units
          .map(u => normalizeCnpj(u.cnpj))
          .filter(c => c.length > 0);
      }
    } catch (e) {
      console.log('[analyze-accounting-xml] Could not fetch additional CNPJs from units table');
    }

    const allLabClinCnpjs = [...new Set([...LABCLIN_CNPJS, ...additionalCnpjs])];
    console.log(`[analyze-accounting-xml] LabClin CNPJs: ${allLabClinCnpjs.join(', ')}`);

    // Tentar parse como NFS-e primeiro (mais comum para serviços)
    let parsed = parseNfse(xml);
    
    // Se não conseguiu, tentar como NF-e
    if (!parsed || (!parsed.emitCnpj && !parsed.destCnpj)) {
      parsed = parseNfe(xml);
    }

    if (!parsed) {
      console.log('[analyze-accounting-xml] Could not parse XML structure');
      return new Response(
        JSON.stringify({
          type: 'unknown',
          documentType: 'outro',
          confidence: 0,
          classificationReason: 'Não foi possível identificar a estrutura do XML. Formato não reconhecido como NF-e ou NFS-e padrão.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-accounting-xml] Parsed as ${parsed.type}:`, JSON.stringify(parsed, null, 2));

    // Determinar classificação
    const emitIsLabClin = allLabClinCnpjs.includes(normalizeCnpj(parsed.emitCnpj));
    const destIsLabClin = allLabClinCnpjs.includes(normalizeCnpj(parsed.destCnpj));

    let type: 'revenue' | 'expense' | 'unknown';
    let classificationReason: string;

    if (emitIsLabClin && !destIsLabClin) {
      type = 'revenue';
      classificationReason = `Prestador ${parsed.emitNome || parsed.emitCnpj} (LabClin) → Tomador ${parsed.destNome || parsed.destCnpj}`;
    } else if (destIsLabClin && !emitIsLabClin) {
      type = 'expense';
      classificationReason = `Fornecedor ${parsed.emitNome || parsed.emitCnpj} → LabClin ${parsed.destNome || parsed.destCnpj}`;
    } else if (emitIsLabClin && destIsLabClin) {
      type = 'unknown';
      classificationReason = 'Ambos CNPJ (emitente e destinatário) pertencem ao LabClin. Transferência interna ou erro de cadastro.';
    } else {
      type = 'unknown';
      classificationReason = 'Nenhum dos CNPJs corresponde às unidades do LabClin cadastradas. Requer classificação manual.';
    }

    console.log(`[analyze-accounting-xml] Classification: ${type} - ${classificationReason}`);

    const result = {
      type,
      documentType: parsed.type === 'nfse' ? 'nfse' : 'nf_produto',
      issuerCnpj: parsed.emitCnpj,
      issuerName: parsed.emitNome,
      customerCnpj: parsed.destCnpj,
      customerName: parsed.destNome,
      documentNumber: parsed.numero,
      series: parsed.serie,
      issueDate: formatDate(parsed.dataEmissao),
      dueDate: null,
      totalValue: parsed.valorTotal || parsed.valorServicos,
      netValue: parsed.valorServicos || parsed.valorTotal,
      taxes: {
        iss: parsed.iss || 0,
        inss: parsed.inss || 0,
        pis: parsed.pis || 0,
        cofins: parsed.cofins || 0,
      },
      verificationCode: parsed.codigoVerificacao,
      description: parsed.descricao,
      confidence: 100, // Parse direto = 100% de confiança
      classificationReason,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-accounting-xml] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze XML',
        details: errorMessage,
        type: 'unknown',
        documentType: 'outro',
        confidence: 0,
        classificationReason: `Erro ao processar XML: ${errorMessage}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
