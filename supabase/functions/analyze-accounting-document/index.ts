import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzedDocResult {
  type: 'revenue' | 'expense' | 'unknown';
  documentType: 'nfse' | 'nf_produto' | 'boleto' | 'recibo' | 'extrato' | 'outro';
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
}

// Normaliza CNPJ removendo pontuação
function normalizeCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, '');
}

// Classifica documento baseado nos CNPJs
function classifyDocument(
  issuerCnpj: string | null,
  customerCnpj: string | null,
  issuerName: string | null,
  customerName: string | null,
  labClinCnpjs: string[]
): { type: 'revenue' | 'expense' | 'unknown'; reason: string } {
  const normalizedIssuer = normalizeCnpj(issuerCnpj);
  const normalizedCustomer = normalizeCnpj(customerCnpj);
  
  const issuerIsLabClin = normalizedIssuer && labClinCnpjs.includes(normalizedIssuer);
  const customerIsLabClin = normalizedCustomer && labClinCnpjs.includes(normalizedCustomer);
  
  // Regra 1: Se prestador é LabClin e tomador NÃO é LabClin → RECEITA
  if (issuerIsLabClin && !customerIsLabClin) {
    return {
      type: 'revenue',
      reason: `Prestador ${issuerName || issuerCnpj} (LabClin) → Tomador ${customerName || customerCnpj}`
    };
  }
  
  // Regra 2: Se tomador é LabClin e prestador NÃO é LabClin → DESPESA
  if (customerIsLabClin && !issuerIsLabClin) {
    return {
      type: 'expense',
      reason: `Fornecedor ${issuerName || issuerCnpj} → LabClin ${customerName || customerCnpj}`
    };
  }
  
  // Regra 3: Ambos são LabClin ou nenhum é → UNKNOWN (revisão manual)
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
        JSON.stringify({ error: 'OpenAI API key not configured' }),
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
    console.log('Processing accounting document with OpenAI GPT-4o-mini...');

    const systemPrompt = `Você é um especialista em extrair dados de documentos fiscais brasileiros.
Analise o documento fornecido e extraia os dados estruturados.

TIPOS DE DOCUMENTO:
- nfse: Nota Fiscal de Serviço Eletrônica
- nf_produto: Nota Fiscal de Produto/Mercadoria
- boleto: Boleto bancário
- recibo: Recibo/Comprovante
- extrato: Extrato bancário
- outro: Outros documentos

CAMPOS A EXTRAIR:
- Tipo do documento
- CNPJ e Nome do PRESTADOR/EMISSOR (quem emitiu o documento)
- CNPJ e Nome do TOMADOR/CONTRATANTE (para quem foi emitido)
- Número do documento e série (se houver)
- Data de emissão
- Data de vencimento (se houver)
- Valor total e valor líquido
- Impostos (ISS, INSS, PIS, COFINS)
- Código de verificação (se houver)
- Descrição dos serviços/produtos
- Competência (mês/ano)

IMPORTANTE: Sempre identifique corretamente quem é o PRESTADOR (quem presta o serviço/vende) e quem é o TOMADOR (quem contrata/compra).

Retorne os dados no formato JSON. Para valores monetários, use números (ex: 11987.46). Para datas, use YYYY-MM-DD.`;

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
                  url: `data:${mimeType || 'image/png'};base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extraia todos os dados fiscais deste documento e retorne no formato JSON especificado.'
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_fiscal_data',
              description: 'Extrai dados estruturados de documentos fiscais brasileiros',
              parameters: {
                type: 'object',
                properties: {
                  document_type: {
                    type: 'string',
                    enum: ['nfse', 'nf_produto', 'boleto', 'recibo', 'extrato', 'outro'],
                    description: 'Tipo do documento fiscal'
                  },
                  issuer_cnpj: {
                    type: 'string',
                    description: 'CNPJ do PRESTADOR/EMISSOR (quem emitiu)'
                  },
                  issuer_name: {
                    type: 'string',
                    description: 'Nome/Razão social do PRESTADOR/EMISSOR'
                  },
                  customer_cnpj: {
                    type: 'string',
                    description: 'CNPJ do TOMADOR/CONTRATANTE (para quem foi emitido)'
                  },
                  customer_name: {
                    type: 'string',
                    description: 'Nome/Razão social do TOMADOR/CONTRATANTE'
                  },
                  document_number: {
                    type: 'string',
                    description: 'Número do documento (ex: 196/2025)'
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
                    description: 'Data de vencimento no formato YYYY-MM-DD (se houver)'
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
                    description: 'Descrição dos serviços/produtos'
                  },
                  competence_year: {
                    type: 'integer',
                    description: 'Ano de competência'
                  },
                  competence_month: {
                    type: 'integer',
                    description: 'Mês de competência (1-12)'
                  },
                  confidence: {
                    type: 'number',
                    description: 'Nível de confiança da extração (0 a 1)'
                  }
                },
                required: ['document_type', 'confidence']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_fiscal_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to process document with OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'extract_fiscal_data') {
      console.error('No valid tool call in response');
      return new Response(
        JSON.stringify({ 
          type: 'unknown',
          documentType: 'outro',
          confidence: 0,
          classificationReason: 'Não foi possível extrair dados do documento'
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
          classificationReason: 'Erro ao processar dados extraídos'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted data:', extractedData);

    // Classificar como receita ou despesa
    const classification = classifyDocument(
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
        classificationReason: 'Erro ao processar documento'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
