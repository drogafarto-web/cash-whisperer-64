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
  cnpj: string | null;
  competencia: { ano: number; mes: number } | null;
  confidence: number;
  raw_text: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, file_name } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing OCR for tax document: ${file_name || 'unknown'}`);

    // Use Lovable AI for OCR
    const response = await fetch('https://api.lovable.ai/v1/chat/completions', {
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
  "tipo_documento": "das" | "darf" | "gps" | "inss" | "fgts" | "folha" | "nf_servico" | "outro",
  "valor": número em centavos (ex: 1523.45 = 152345),
  "vencimento": "YYYY-MM-DD" ou null,
  "codigo_barras": string com código de barras completo ou null,
  "linha_digitavel": string com linha digitável formatada ou null,
  "cnpj": string apenas números ou null,
  "competencia": { "ano": 2024, "mes": 11 } ou null,
  "confidence": 0.0 a 1.0 (sua confiança na extração)
}

Regras importantes:
- DAS: Documento de Arrecadação do Simples Nacional
- DARF: Documento de Arrecadação de Receitas Federais
- GPS: Guia da Previdência Social
- INSS: guia específica do INSS
- FGTS: Guia de Recolhimento do FGTS
- folha: resumo/holerite de folha de pagamento
- nf_servico: nota fiscal de serviços
- outro: qualquer outro tipo de documento

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
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    // Parse JSON from response
    let ocrData: OCRResult;
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      const parsed = JSON.parse(jsonStr);
      
      ocrData = {
        tipo_documento: parsed.tipo_documento || 'outro',
        valor: parsed.valor ? Number(parsed.valor) / 100 : null, // Convert from centavos
        vencimento: parsed.vencimento || null,
        codigo_barras: parsed.codigo_barras || null,
        linha_digitavel: parsed.linha_digitavel || null,
        cnpj: parsed.cnpj || null,
        competencia: parsed.competencia || null,
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
        cnpj: null,
        competencia: null,
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
