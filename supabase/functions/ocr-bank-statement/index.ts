import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'ENTRADA' | 'SAIDA';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, pageNumber } = await req.json();
    
    if (!imageBase64) {
      throw new Error('imageBase64 is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Processing page ${pageNumber || 1}...`);

    const systemPrompt = `Você é um especialista em extrair dados de extratos bancários brasileiros.
Analise a imagem do extrato bancário e extraia TODAS as transações listadas.

Para cada transação, extraia:
- date: Data da transação no formato YYYY-MM-DD
- description: Descrição/histórico completo da transação
- amount: Valor absoluto (sempre positivo, sem sinal)
- type: "ENTRADA" para créditos/depósitos/recebimentos, "SAIDA" para débitos/pagamentos/transferências enviadas

REGRAS IMPORTANTES:
1. IGNORE linhas de saldo (saldo anterior, saldo atual, saldo do dia)
2. IGNORE totalizadores e resumos
3. Capture TODAS as linhas que representam transações reais
4. Valores com sinal negativo, indicador "D", "DEB" ou "(-)" = SAIDA
5. Valores com sinal positivo, indicador "C", "CRED" ou sem indicador de débito = ENTRADA
6. Se a descrição mencionar TED/DOC/PIX ENVIADO = SAIDA
7. Se a descrição mencionar TED/DOC/PIX RECEBIDO = ENTRADA
8. Mantenha a descrição original do banco, não modifique

Retorne APENAS um array JSON válido com as transações, sem texto adicional.
Se não encontrar transações, retorne [].

Exemplo de resposta:
[
  {"date": "2024-01-15", "description": "TED RECEBIDO - FULANO DE TAL", "amount": 1500.00, "type": "ENTRADA"},
  {"date": "2024-01-15", "description": "PAGTO COBRANCA CEDENTE: CEMIG", "amount": 245.80, "type": "SAIDA"}
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Extraia todas as transações desta página do extrato bancário. Retorne apenas o JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    console.log('Raw AI response:', content.substring(0, 500));

    // Parse the JSON response
    let transactions: Transaction[] = [];
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();
      
      transactions = JSON.parse(cleanedContent);
      
      // Validate and clean the transactions
      transactions = transactions
        .filter((t: any) => t.date && t.description && typeof t.amount === 'number' && t.type)
        .map((t: any) => ({
          date: t.date,
          description: String(t.description).trim(),
          amount: Math.abs(Number(t.amount)),
          type: t.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
        }));
        
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Content was:', content);
      // Return empty array instead of failing
      transactions = [];
    }

    console.log(`Extracted ${transactions.length} transactions from page ${pageNumber || 1}`);

    return new Response(JSON.stringify({ 
      transactions,
      pageNumber: pageNumber || 1,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ocr-bank-statement:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      transactions: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
