import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceOcrResult {
  document_number: string | null;
  document_full_number: string | null;
  verification_code: string | null;
  issue_date: string | null;
  competence_year: number | null;
  competence_month: number | null;
  service_value: number | null;
  deductions: number | null;
  iss_value: number | null;
  net_value: number | null;
  issuer_name: string | null;
  issuer_cnpj: string | null;
  customer_name: string | null;
  customer_cnpj: string | null;
  customer_city: string | null;
  description: string | null;
  service_code: string | null;
  cnae: string | null;
  confidence: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, mimeType } = await req.json();

    if (!pdfBase64) {
      console.error('No PDF data provided');
      return new Response(
        JSON.stringify({ error: 'PDF base64 data is required' }),
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

    console.log('Processing NFS-e PDF with OpenAI...');

    const systemPrompt = `Você é um especialista em extrair dados de Notas Fiscais de Serviço Eletrônicas (NFS-e) brasileiras.

Analise o documento PDF fornecido e extraia os seguintes campos:
- Número da nota (ex: "196/2025")
- Número integral da nota (ex: "202500000000196")
- Código de verificação
- Data de emissão
- Mês e ano de competência (separadamente)
- Valor total de serviços
- Deduções (se houver)
- Valor do ISS (se houver)
- Valor líquido
- Nome e CNPJ do prestador (emissor)
- Nome, CNPJ e cidade do tomador
- Discriminação dos serviços
- Código do serviço
- CNAE (se disponível)

Retorne SOMENTE os dados que conseguir extrair com confiança. Para valores monetários, retorne como número (ex: 11987.46). Para datas, use formato YYYY-MM-DD.`;

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
                  url: `data:${mimeType || 'application/pdf'};base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extraia os dados desta NFS-e e retorne no formato JSON especificado.'
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_invoice_data',
              description: 'Extrai os dados estruturados de uma NFS-e brasileira',
              parameters: {
                type: 'object',
                properties: {
                  document_number: { 
                    type: 'string', 
                    description: 'Número da nota fiscal (ex: 196/2025)' 
                  },
                  document_full_number: { 
                    type: 'string', 
                    description: 'Número integral da nota (ex: 202500000000196)' 
                  },
                  verification_code: { 
                    type: 'string', 
                    description: 'Código de verificação/autenticidade' 
                  },
                  issue_date: { 
                    type: 'string', 
                    description: 'Data de emissão no formato YYYY-MM-DD' 
                  },
                  competence_year: { 
                    type: 'integer', 
                    description: 'Ano de competência (ex: 2025)' 
                  },
                  competence_month: { 
                    type: 'integer', 
                    description: 'Mês de competência (1-12)' 
                  },
                  service_value: { 
                    type: 'number', 
                    description: 'Valor total dos serviços' 
                  },
                  deductions: { 
                    type: 'number', 
                    description: 'Valor das deduções' 
                  },
                  iss_value: { 
                    type: 'number', 
                    description: 'Valor do ISS' 
                  },
                  net_value: { 
                    type: 'number', 
                    description: 'Valor líquido da nota' 
                  },
                  issuer_name: { 
                    type: 'string', 
                    description: 'Nome/Razão social do prestador' 
                  },
                  issuer_cnpj: { 
                    type: 'string', 
                    description: 'CNPJ do prestador' 
                  },
                  customer_name: { 
                    type: 'string', 
                    description: 'Nome/Razão social do tomador' 
                  },
                  customer_cnpj: { 
                    type: 'string', 
                    description: 'CNPJ do tomador' 
                  },
                  customer_city: { 
                    type: 'string', 
                    description: 'Cidade do tomador' 
                  },
                  description: { 
                    type: 'string', 
                    description: 'Discriminação dos serviços' 
                  },
                  service_code: { 
                    type: 'string', 
                    description: 'Código do serviço' 
                  },
                  cnae: { 
                    type: 'string', 
                    description: 'Código CNAE' 
                  },
                  confidence: { 
                    type: 'number', 
                    description: 'Nível de confiança da extração (0-1)' 
                  }
                },
                required: ['confidence']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_invoice_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API access issue. Check your billing/quota.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to process PDF with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenAI response received:', JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'extract_invoice_data') {
      console.error('No valid tool call in response');
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract invoice data',
          confidence: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedData: InvoiceOcrResult;
    try {
      extractedData = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool call arguments:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse extracted data',
          confidence: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted invoice data:', extractedData);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ocr-invoice function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
