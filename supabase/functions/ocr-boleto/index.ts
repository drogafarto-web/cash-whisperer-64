import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoletoOcrResult {
  linha_digitavel: string | null;
  codigo_barras: string | null;
  banco_codigo: string | null;
  banco_nome: string | null;
  beneficiario: string | null;
  beneficiario_cnpj: string | null;
  valor: number | null;
  vencimento: string | null;
  nosso_numero: string | null;
  documento: string | null;
  confidence: number;
}

const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "341": "Itaú",
  "356": "Banco Real",
  "389": "Banco Mercantil do Brasil",
  "399": "HSBC",
  "422": "Banco Safra",
  "453": "Banco Rural",
  "633": "Banco Rendimento",
  "652": "Itaú Unibanco",
  "707": "Banco Daycoval",
  "745": "Citibank",
  "756": "Sicoob",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    
    if (!imageBase64) {
      throw new Error("Imagem do boleto é obrigatória");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não está configurada");
    }

    console.log("Processando OCR de boleto com OpenAI gpt-4o-mini...");

    const prompt = `Analise esta imagem de um BOLETO BANCÁRIO brasileiro e extraia as seguintes informações em JSON:

{
  "linha_digitavel": "string com 47 ou 48 dígitos, separados por pontos e espaços conforme impresso",
  "codigo_barras": "string com 44 dígitos do código de barras (se visível)",
  "banco_codigo": "3 primeiros dígitos que identificam o banco",
  "beneficiario": "nome do beneficiário/cedente",
  "beneficiario_cnpj": "CNPJ do beneficiário se visível",
  "valor": número decimal do valor do boleto,
  "vencimento": "YYYY-MM-DD" (data de vencimento),
  "nosso_numero": "nosso número do boleto",
  "documento": "número do documento",
  "confidence": número de 0 a 100 indicando a confiança da extração
}

INSTRUÇÕES IMPORTANTES:
1. A linha digitável tem 47 ou 48 dígitos e geralmente está no topo do boleto
2. O código de barras tem 44 dígitos e está na parte inferior
3. Os 3 primeiros dígitos da linha digitável identificam o banco (ex: 001 = BB, 033 = Santander, 237 = Bradesco, 341 = Itaú)
4. O valor pode estar em campos como "Valor do documento" ou "Valor"
5. Se algum campo não for encontrado, use null
6. Retorne APENAS o JSON, sem explicações`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Chave da API OpenAI inválida." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Problema de acesso/faturamento/cota na OpenAI." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Erro ao processar imagem com IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("OCR boleto response:", content);

    let ocrData: Partial<BoletoOcrResult>;
    try {
      ocrData = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        ocrData = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          ocrData = JSON.parse(objectMatch[0]);
        } else {
          throw new Error("Não foi possível extrair dados do boleto");
        }
      }
    }

    // Enrich with bank name if we have the code
    if (ocrData.banco_codigo) {
      const bancoCode = ocrData.banco_codigo.padStart(3, "0");
      ocrData.banco_nome = BANCOS[bancoCode] || null;
    } else if (ocrData.linha_digitavel) {
      const cleanLinha = ocrData.linha_digitavel.replace(/[\s.]/g, "");
      if (cleanLinha.length >= 3) {
        const bancoCode = cleanLinha.substring(0, 3);
        ocrData.banco_codigo = bancoCode;
        ocrData.banco_nome = BANCOS[bancoCode] || null;
      }
    }

    const result: BoletoOcrResult = {
      linha_digitavel: ocrData.linha_digitavel || null,
      codigo_barras: ocrData.codigo_barras || null,
      banco_codigo: ocrData.banco_codigo || null,
      banco_nome: ocrData.banco_nome || null,
      beneficiario: ocrData.beneficiario || null,
      beneficiario_cnpj: ocrData.beneficiario_cnpj || null,
      valor: ocrData.valor || null,
      vencimento: ocrData.vencimento || null,
      nosso_numero: ocrData.nosso_numero || null,
      documento: ocrData.documento || null,
      confidence: ocrData.confidence || (ocrData as Record<string, unknown>).confianca as number || 0,
    };

    console.log("OCR boleto result:", result);

    return new Response(JSON.stringify({ ocrData: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OCR boleto error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
