import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRResult {
  tipo_documento: string;
  valor: number | null;
  vencimento: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  cnpj_contribuinte: string | null;
  competencia: { ano: number; mes: number } | null;
  beneficiario: string | null;
  pix_key: string | null;
  pix_tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  sugestao: string | null;
  alertas: string[];
  confidence: number;
  raw_text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, file_name, competencia } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing OCR for tax document: ${file_name || 'unknown'}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem de documento fiscal/tributário brasileiro e extraia as seguintes informações em JSON:

{
  "tipo_documento": "das" | "darf" | "gps" | "inss" | "fgts" | "iss" | "nf_servico" | "outro",
  "valor": número em reais (ex: 1523.45),
  "vencimento": "YYYY-MM-DD" ou null,
  "codigo_barras": string com código de barras completo ou null,
  "linha_digitavel": string com linha digitável formatada ou null,
  "cnpj_contribuinte": string apenas números ou null,
  "beneficiario": string nome do beneficiário/destinatário ou null,
  "competencia": { "ano": 2024, "mes": 11 } ou null,
  "pix_key": string chave PIX se encontrada ou null,
  "pix_tipo": "cpf" | "cnpj" | "email" | "telefone" | "aleatoria" ou null,
  "sugestao": "Sugestão contextual para o contador baseada nos dados extraídos",
  "alertas": ["Lista de alertas se houver problemas detectados"],
  "confidence": 0.0 a 1.0
}

Competência esperada: ${competencia?.mes || '?'}/${competencia?.ano || '?'}

Regras importantes:
- DAS: Documento de Arrecadação do Simples Nacional
- DARF: Documento de Arrecadação de Receitas Federais
- GPS: Guia da Previdência Social
- INSS: guia específica do INSS
- FGTS: Guia de Recolhimento do FGTS
- ISS: Imposto Sobre Serviços (municipal)
- nf_servico: nota fiscal de serviços
- outro: qualquer outro tipo de documento

Alertas a verificar:
- Se vencimento já passou, alertar "Vencimento já passou em DD/MM/YYYY"
- Se competência diferente da esperada, alertar
- Se valor parece anormalmente alto ou baixo

Sugestão: seja útil para o contador, ex: "DAS de Jan/2026 no valor de R$ 3.500. Valor dentro do esperado para faturamento do Simples."

Se não conseguir identificar algum campo, retorne null para ele.
Retorne APENAS o JSON, sem explicações.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image_base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    let ocrData: OCRResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      const parsed = JSON.parse(jsonStr);
      
      ocrData = {
        tipo_documento: parsed.tipo_documento || 'outro',
        valor: parsed.valor ?? null,
        vencimento: parsed.vencimento || null,
        codigo_barras: parsed.codigo_barras || null,
        linha_digitavel: parsed.linha_digitavel || null,
        cnpj_contribuinte: parsed.cnpj_contribuinte || null,
        beneficiario: parsed.beneficiario || null,
        competencia: parsed.competencia || null,
        pix_key: parsed.pix_key || null,
        pix_tipo: parsed.pix_tipo || null,
        sugestao: parsed.sugestao || null,
        alertas: parsed.alertas || [],
        confidence: parsed.confidence || 0.5,
        raw_text: content,
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      ocrData = {
        tipo_documento: 'outro',
        valor: null,
        vencimento: null,
        codigo_barras: null,
        linha_digitavel: null,
        cnpj_contribuinte: null,
        beneficiario: null,
        competencia: null,
        pix_key: null,
        pix_tipo: null,
        sugestao: null,
        alertas: ['Não foi possível processar o documento automaticamente'],
        confidence: 0,
        raw_text: content,
      };
    }

    console.log('Extracted OCR data:', ocrData);

    return new Response(
      JSON.stringify({ success: true, data: ocrData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('OCR processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});