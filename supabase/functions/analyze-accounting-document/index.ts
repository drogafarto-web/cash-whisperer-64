import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de documentos tributários (sempre despesa)
const TAX_DOCUMENT_TYPES = ['darf', 'gps', 'das', 'fgts', 'inss_guia'];

// Tipos de documentos de RH/Folha (sempre despesa)
const PAYROLL_DOCUMENT_TYPES = ['holerite', 'folha_pagamento'];

interface AnalyzedDocResult {
  type: 'revenue' | 'expense' | 'unknown';
  documentType: 'nfse' | 'nf_produto' | 'boleto' | 'recibo' | 'extrato' | 'darf' | 'gps' | 'das' | 'fgts' | 'inss_guia' | 'holerite' | 'folha_pagamento' | 'outro';
  issuerCnpj: string | null;
  customerCnpj: string | null;
  issuerName: string | null;
  customerName: string | null;
  documentNumber: string | null;
  series: string | null;
  issueDate: string | null;
  dueDate: string | null;
  totalValue: number | null;
  netValue: number | null;
  taxes: {
    iss: number | null;
    inss: number | null;
    pis: number | null;
    cofins: number | null;
  };
  verificationCode: string | null;
  description: string | null;
  confidence: number;
  classificationReason: string;
  competenceYear: number | null;
  competenceMonth: number | null;
  codigoBarras: string | null;
  linhaDigitavel: string | null;
  pixKey: string | null;
  pixTipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  attendantSuggestion: string | null;
}

function normalizeCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, '');
}

function classifyDocument(
  documentType: string,
  issuerCnpj: string | null,
  customerCnpj: string | null,
  issuerName: string | null,
  customerName: string | null,
  labClinCnpjs: string[]
): { type: 'revenue' | 'expense' | 'unknown'; reason: string } {
  
  if (TAX_DOCUMENT_TYPES.includes(documentType)) {
    const docLabel = documentType.toUpperCase().replace('_', ' ');
    return {
      type: 'expense',
      reason: `Guia tributária ${docLabel} - despesa fiscal obrigatória`
    };
  }
  
  if (PAYROLL_DOCUMENT_TYPES.includes(documentType)) {
    return {
      type: 'expense',
      reason: 'Documento de folha de pagamento - despesa com pessoal'
    };
  }
  
  const normalizedIssuer = normalizeCnpj(issuerCnpj);
  const normalizedCustomer = normalizeCnpj(customerCnpj);
  
  const issuerIsLabClin = normalizedIssuer && labClinCnpjs.includes(normalizedIssuer);
  const customerIsLabClin = normalizedCustomer && labClinCnpjs.includes(normalizedCustomer);
  
  if (issuerIsLabClin && !customerIsLabClin) {
    return {
      type: 'revenue',
      reason: `Prestador ${issuerName || issuerCnpj} (LabClin) → Tomador ${customerName || customerCnpj}`
    };
  }
  
  if (customerIsLabClin && !issuerIsLabClin) {
    return {
      type: 'expense',
      reason: `Fornecedor ${issuerName || issuerCnpj} → LabClin ${customerName || customerCnpj}`
    };
  }
  
  if (issuerIsLabClin && customerIsLabClin) {
    return {
      type: 'unknown',
      reason: 'Operação entre unidades LabClin - requer revisão manual'
    };
  }
  
  return {
    type: 'unknown',
    reason: 'CNPJs não identificados como LabClin - requer revisão manual'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, unitId } = await req.json();

    if (!imageBase64) {
      console.error('No image data provided');
      return new Response(
        JSON.stringify({ error: 'Image base64 data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não está configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar CNPJs do LabClin do banco de dados
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: units } = await supabase
      .from('units')
      .select('cnpj, razao_social')
      .not('cnpj', 'is', null);

    const labClinCnpjs = (units || [])
      .map(u => normalizeCnpj(u.cnpj))
      .filter((cnpj): cnpj is string => cnpj !== null && cnpj.length > 0);

    console.log('LabClin CNPJs cadastrados:', labClinCnpjs);
    console.log('Processing accounting document with OpenAI gpt-4o-mini...');

    const systemPrompt = `Você é um especialista em extrair dados de documentos fiscais brasileiros.
Analise o documento fornecido e extraia os dados estruturados.

TIPOS DE DOCUMENTO:
- nfse: Nota Fiscal de Serviço Eletrônica
- nf_produto: Nota Fiscal de Produto/Mercadoria
- boleto: Boleto bancário comercial (de fornecedores)
- recibo: Recibo/Comprovante genérico
- extrato: Extrato bancário
- darf: DARF - Documento de Arrecadação de Receitas Federais
- gps: GPS - Guia da Previdência Social
- das: DAS - Documento de Arrecadação do Simples Nacional
- fgts: FGTS - Guia de Recolhimento do Fundo de Garantia
- inss_guia: Guia específica do INSS (não GPS)
- holerite: Holerite/Contracheque/Recibo de Pagamento de funcionário
- folha_pagamento: Resumo da Folha de Pagamento mensal
- outro: Outros documentos

COMO IDENTIFICAR DOCUMENTOS DE FOLHA DE PAGAMENTO (RH):
- HOLERITE: Contém "Recibo de Pagamento", "Contracheque", "Holerite" ou "Demonstrativo de Pagamento"
- Lista vencimentos (salário base, horas extras, adicionais, gratificações)
- Lista descontos (INSS, IRRF, Vale-Transporte, Vale-Refeição, FGTS)
- Mostra mês/ano de competência da folha
- Nome, cargo e dados do funcionário
- CNPJ e nome do empregador
- Valor líquido a receber pelo funcionário
- SEMPRE são DESPESAS da empresa (pagamento de salário ao funcionário)

COMO IDENTIFICAR DOCUMENTOS TRIBUTÁRIOS:
- DARF: Documento com brasão da República, "Receita Federal", "DARF", código de receita
- GPS: Documento com brasão do INSS, "GPS - Guia da Previdência Social", NIT/PIS/PASEP
- DAS: Documento com "Simples Nacional", "DAS - Documento de Arrecadação"
- FGTS: Documento com "Caixa Econômica Federal", "FGTS", "GRF"
- INSS_GUIA: Guia específica INSS (diferente de GPS)

IMPORTANTE:
- Holerites/Contracheques são documentos de RH, não confundir com recibos comerciais
- Em um holerite, o PRESTADOR/EMISSOR é a EMPRESA que paga o salário
- Em um holerite, o nome do FUNCIONÁRIO deve ir na DESCRIÇÃO, não como tomador
- Guias tributárias (DARF, GPS, DAS, FGTS) são documentos do governo para pagamento de impostos
- Boletos são de empresas comerciais (fornecedores, serviços)
- Sempre identifique corretamente quem é o PRESTADOR e quem é o TOMADOR
- Extraia código de barras e linha digitável quando disponíveis

CAMPOS A EXTRAIR:
- Tipo do documento
- CNPJ e Nome do PRESTADOR/EMISSOR (quem emitiu - para holerite é o empregador)
- CNPJ e Nome do TOMADOR/CONTRATANTE (para quem foi emitido)
- Número do documento e série
- Data de emissão e vencimento
- Valor total e valor líquido
- Impostos (ISS, INSS, PIS, COFINS)
- Código de verificação
- Descrição dos serviços/produtos (para holerite: nome e cargo do funcionário)
- Competência (mês/ano)
- Código de barras e Linha digitável
- Chave PIX (se encontrada)

GERE UMA SUGESTÃO CONTEXTUAL (campo attendant_suggestion) para o atendente que explique:
1. O que é este documento e qual seu propósito
2. Como ele deve ser cadastrado (receita, despesa, categoria sugerida)
3. Pontos de atenção (vencimentos, retenções, duplicidades comuns)
4. Próximos passos recomendados

Exemplos de sugestões:
- Holerite: "Este é o holerite do funcionário [Nome] ref. [Mês/Ano]. Cadastre como DESPESA de Folha de Pagamento. Valor líquido: R$ X. Verifique se as guias de FGTS e INSS do mês já foram lançadas separadamente."
- NFS-e emitida: "Esta NFS-e foi emitida pelo LabClin para [Cliente]. Cadastre como RECEITA. Há retenção de ISS de R$ X que deve ser considerada no valor líquido."
- Boleto de fornecedor: "Boleto de [Fornecedor] com vencimento em [Data]. Cadastre como DESPESA. Verifique se já existe boleto similar cadastrado para evitar duplicidade."
- DARF: "Guia DARF para pagamento de tributo federal. Cadastre como DESPESA na categoria Impostos. Vencimento: [Data]. Valor: R$ X."

Retorne os dados no formato JSON. Para valores monetários, use números. Para datas, use YYYY-MM-DD.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: 'Extraia todos os dados fiscais deste documento e retorne no formato JSON especificado. Identifique especialmente se é uma guia tributária (DARF, GPS, DAS, FGTS) ou um documento comercial.'
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_fiscal_data',
              description: 'Extrai dados estruturados de documentos fiscais brasileiros, incluindo guias tributárias',
              parameters: {
                type: 'object',
                properties: {
                  document_type: {
                    type: 'string',
                    enum: ['nfse', 'nf_produto', 'boleto', 'recibo', 'extrato', 'darf', 'gps', 'das', 'fgts', 'inss_guia', 'holerite', 'folha_pagamento', 'outro'],
                    description: 'Tipo do documento fiscal ou de RH'
                  },
                  issuer_cnpj: {
                    type: 'string',
                    description: 'CNPJ do PRESTADOR/EMISSOR (quem emitiu). Para guias tributárias, é o CNPJ do contribuinte.'
                  },
                  issuer_name: {
                    type: 'string',
                    description: 'Nome/Razão social do PRESTADOR/EMISSOR ou contribuinte'
                  },
                  customer_cnpj: {
                    type: 'string',
                    description: 'CNPJ do TOMADOR/CONTRATANTE. Para guias tributárias, deixar vazio.'
                  },
                  customer_name: {
                    type: 'string',
                    description: 'Nome/Razão social do TOMADOR/CONTRATANTE'
                  },
                  document_number: {
                    type: 'string',
                    description: 'Número do documento ou código de referência'
                  },
                  series: {
                    type: 'string',
                    description: 'Série do documento (se houver)'
                  },
                  issue_date: {
                    type: 'string',
                    description: 'Data de emissão no formato YYYY-MM-DD'
                  },
                  due_date: {
                    type: 'string',
                    description: 'Data de vencimento no formato YYYY-MM-DD'
                  },
                  total_value: {
                    type: 'number',
                    description: 'Valor total/bruto do documento'
                  },
                  net_value: {
                    type: 'number',
                    description: 'Valor líquido (após deduções)'
                  },
                  iss_value: {
                    type: 'number',
                    description: 'Valor do ISS'
                  },
                  inss_value: {
                    type: 'number',
                    description: 'Valor do INSS retido'
                  },
                  pis_value: {
                    type: 'number',
                    description: 'Valor do PIS'
                  },
                  cofins_value: {
                    type: 'number',
                    description: 'Valor do COFINS'
                  },
                  verification_code: {
                    type: 'string',
                    description: 'Código de verificação/autenticidade'
                  },
                  description: {
                    type: 'string',
                    description: 'Descrição dos serviços/produtos ou tipo de tributo'
                  },
                  competence_year: {
                    type: 'integer',
                    description: 'Ano de competência'
                  },
                  competence_month: {
                    type: 'integer',
                    description: 'Mês de competência (1-12)'
                  },
                  codigo_barras: {
                    type: 'string',
                    description: 'Código de barras numérico (44-48 dígitos) sem espaços ou pontos'
                  },
                  linha_digitavel: {
                    type: 'string',
                    description: 'Linha digitável formatada com pontos e espaços'
                  },
                  pix_key: {
                    type: 'string',
                    description: 'Chave PIX encontrada no documento (copia e cola ou chave)'
                  },
                  pix_tipo: {
                    type: 'string',
                    enum: ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'],
                    description: 'Tipo da chave PIX'
                  },
                  confidence: {
                    type: 'number',
                    description: 'Nível de confiança da extração (0 a 1)'
                  },
                  attendant_suggestion: {
                    type: 'string',
                    description: 'Sugestão contextual para o atendente explicando: 1) O que é o documento, 2) Como deve ser cadastrado (receita/despesa, categoria), 3) Pontos de atenção (vencimentos, retenções), 4) Próximos passos. Escreva de forma clara e objetiva em português.'
                  }
                },
                required: ['document_type', 'confidence', 'attendant_suggestion']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_fiscal_data' } },
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Chave da API OpenAI inválida.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Problema de acesso/faturamento/cota na OpenAI.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to process document with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenAI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'extract_fiscal_data') {
      console.error('No valid tool call in response');
      return new Response(
        JSON.stringify({ 
          type: 'unknown',
          documentType: 'outro',
          confidence: 0,
          classificationReason: 'Não foi possível extrair dados do documento',
          codigoBarras: null,
          linhaDigitavel: null,
          pixKey: null,
          pixTipo: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedData: any;
    try {
      extractedData = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool call arguments:', parseError);
      return new Response(
        JSON.stringify({ 
          type: 'unknown',
          documentType: 'outro',
          confidence: 0,
          classificationReason: 'Erro ao processar dados extraídos',
          codigoBarras: null,
          linhaDigitavel: null,
          pixKey: null,
          pixTipo: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted data:', extractedData);

    const classification = classifyDocument(
      extractedData.document_type || 'outro',
      extractedData.issuer_cnpj,
      extractedData.customer_cnpj,
      extractedData.issuer_name,
      extractedData.customer_name,
      labClinCnpjs
    );

    const result: AnalyzedDocResult = {
      type: classification.type,
      documentType: extractedData.document_type || 'outro',
      issuerCnpj: extractedData.issuer_cnpj || null,
      customerCnpj: extractedData.customer_cnpj || null,
      issuerName: extractedData.issuer_name || null,
      customerName: extractedData.customer_name || null,
      documentNumber: extractedData.document_number || null,
      series: extractedData.series || null,
      issueDate: extractedData.issue_date || null,
      dueDate: extractedData.due_date || null,
      totalValue: extractedData.total_value || null,
      netValue: extractedData.net_value || null,
      taxes: {
        iss: extractedData.iss_value || null,
        inss: extractedData.inss_value || null,
        pis: extractedData.pis_value || null,
        cofins: extractedData.cofins_value || null,
      },
      verificationCode: extractedData.verification_code || null,
      description: extractedData.description || null,
      confidence: extractedData.confidence || 0,
      classificationReason: classification.reason,
      competenceYear: extractedData.competence_year || null,
      competenceMonth: extractedData.competence_month || null,
      codigoBarras: extractedData.codigo_barras || null,
      linhaDigitavel: extractedData.linha_digitavel || null,
      pixKey: extractedData.pix_key || null,
      pixTipo: extractedData.pix_tipo || null,
      attendantSuggestion: extractedData.attendant_suggestion || null,
    };

    console.log('Final result with classification:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-accounting-document function:', error);
    return new Response(
      JSON.stringify({ 
        type: 'unknown',
        documentType: 'outro',
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0,
        classificationReason: 'Erro ao processar documento',
        codigoBarras: null,
        linhaDigitavel: null,
        pixKey: null,
        pixTipo: null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
