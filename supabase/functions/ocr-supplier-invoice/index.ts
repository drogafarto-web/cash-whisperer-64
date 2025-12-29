import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Parcela {
  numero: number;
  valor: number;
  vencimento: string;
}

interface SupplierInvoiceOcrResult {
  document_number: string | null;
  document_series: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_value: number | null;
  payment_conditions: string | null;
  installments_count: number | null;
  parcelas: Parcela[];
  description: string | null;
  cfop: string | null;
  natureza_operacao: string | null;
  confianca: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    
    if (!imageBase64) {
      throw new Error("Imagem da nota fiscal é obrigatória");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não está configurada");
    }

    console.log("Processando OCR de nota fiscal de fornecedor com OpenAI gpt-4o-mini...");

    const prompt = `Analise esta imagem de uma NOTA FISCAL DE ENTRADA (de fornecedor/compra) e extraia as seguintes informações em JSON:

{
  "document_number": "número da nota fiscal",
  "document_series": "série da nota",
  "supplier_name": "nome/razão social do fornecedor (EMITENTE)",
  "supplier_cnpj": "CNPJ do fornecedor",
  "issue_date": "YYYY-MM-DD" (data de emissão),
  "due_date": "YYYY-MM-DD" (data de vencimento principal, se houver),
  "total_value": número decimal do valor total da nota,
  "payment_conditions": "condições de pagamento se informadas (ex: 30/60/90 dias)",
  "installments_count": número de parcelas,
  "parcelas": [
    {
      "numero": 1,
      "valor": número decimal,
      "vencimento": "YYYY-MM-DD"
    }
  ],
  "description": "descrição resumida dos produtos/serviços",
  "cfop": "código CFOP se visível",
  "natureza_operacao": "natureza da operação",
  "confianca": número de 0 a 100 indicando a confiança da extração
}

INSTRUÇÕES IMPORTANTES:
1. O EMITENTE/fornecedor está na parte superior da nota
2. O DESTINATÁRIO é quem está comprando (ignore esses dados)
3. Se houver duplicatas/boletos listados na nota, extraia cada parcela separadamente
4. Para notas com pagamento à vista, crie apenas 1 parcela com vencimento = data de emissão
5. Se houver "Fatura" ou "Duplicata" na nota, extraia os dados de cada vencimento
6. Se algum campo não for encontrado, use null
7. O array "parcelas" pode estar vazio se não houver informações de pagamento
8. Retorne APENAS o JSON, sem explicações`;

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
        max_tokens: 2000,
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
    
    console.log("OCR supplier invoice response:", content);

    let ocrData: Partial<SupplierInvoiceOcrResult>;
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
          throw new Error("Não foi possível extrair dados da nota fiscal");
        }
      }
    }

    const parcelas = Array.isArray(ocrData.parcelas) ? ocrData.parcelas : [];
    const installmentsCount = ocrData.installments_count || parcelas.length || 1;

    const result: SupplierInvoiceOcrResult = {
      document_number: ocrData.document_number || null,
      document_series: ocrData.document_series || null,
      supplier_name: ocrData.supplier_name || null,
      supplier_cnpj: ocrData.supplier_cnpj || null,
      issue_date: ocrData.issue_date || null,
      due_date: ocrData.due_date || (parcelas.length > 0 ? parcelas[0].vencimento : null),
      total_value: ocrData.total_value || null,
      payment_conditions: ocrData.payment_conditions || null,
      installments_count: installmentsCount,
      parcelas: parcelas,
      description: ocrData.description || null,
      cfop: ocrData.cfop || null,
      natureza_operacao: ocrData.natureza_operacao || null,
      confianca: ocrData.confianca || 0,
    };

    console.log("OCR supplier invoice result:", result);

    return new Response(JSON.stringify({ ocrData: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OCR supplier invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
