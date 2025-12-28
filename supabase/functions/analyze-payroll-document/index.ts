import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayrollResult {
  total_folha: number | null;
  encargos: number | null;
  prolabore: number | null;
  num_funcionarios: number | null;
  competencia: { ano: number; mes: number } | null;
  sugestao: string | null;
  alertas: string[];
  confidence: number;
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

    console.log(`Analyzing payroll document: ${file_name || 'unknown'}`);

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
                text: `Analise esta imagem de documento de folha de pagamento brasileira e extraia as seguintes informações em JSON:

{
  "total_folha": número total bruto da folha (soma de todos os salários),
  "encargos": número total de encargos/contribuições patronais,
  "prolabore": número do pró-labore dos sócios (se houver),
  "num_funcionarios": número inteiro de funcionários listados,
  "competencia": { "ano": 2026, "mes": 1 } ou null,
  "sugestao": "Análise contextual da folha comparando com padrões esperados",
  "alertas": ["Lista de alertas se houver anomalias"],
  "confidence": 0.0 a 1.0
}

Competência esperada: ${competencia?.mes}/${competencia?.ano}

Regras:
- total_folha: soma dos salários brutos de todos funcionários
- encargos: INSS patronal, FGTS, outros encargos sobre a folha
- prolabore: remuneração dos sócios/administradores
- Se não conseguir identificar algum campo, retorne null
- Gere sugestão contextual útil para o contador
- Alertas: competência diferente, valores muito baixos/altos, etc.

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

    let result: PayrollResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      const parsed = JSON.parse(jsonStr);
      
      result = {
        total_folha: parsed.total_folha ?? null,
        encargos: parsed.encargos ?? null,
        prolabore: parsed.prolabore ?? null,
        num_funcionarios: parsed.num_funcionarios ?? null,
        competencia: parsed.competencia ?? null,
        sugestao: parsed.sugestao ?? null,
        alertas: parsed.alertas ?? [],
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      result = {
        total_folha: null,
        encargos: null,
        prolabore: null,
        num_funcionarios: null,
        competencia: null,
        sugestao: null,
        alertas: ['Não foi possível analisar o documento automaticamente'],
        confidence: 0,
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Payroll analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
