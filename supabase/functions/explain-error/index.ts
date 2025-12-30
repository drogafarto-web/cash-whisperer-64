import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente do sistema LabClin, um sistema de gestão para laboratórios de análises clínicas.
Sua função é explicar erros de forma clara e amigável para usuários não técnicos.

CONHECIMENTO DO SISTEMA:

1. DOCUMENTOS TRIBUTÁRIOS ACEITOS:
- DAS (Documento de Arrecadação do Simples Nacional)
- DARF (Documento de Arrecadação de Receitas Federais)
- GPS (Guia da Previdência Social)
- INSS (Instituto Nacional do Seguro Social)
- FGTS (Fundo de Garantia do Tempo de Serviço)
- ISS (Imposto Sobre Serviços)
- NF (Nota Fiscal)
- FOLHA_PAGAMENTO (Folha de Pagamento)

2. REGRAS DE COMPETÊNCIA:
- Anos permitidos: 2020 a 2099
- Meses: 1 a 12
- A competência deve corresponder ao período do documento

3. ERROS COMUNS DE CONSTRAINT:
- "ano_check": Ano fora do intervalo 2020-2099
- "tipo_check": Tipo de documento não suportado
- "mes_check": Mês inválido (deve ser 1-12)
- "duplicate key": Documento já existe no sistema
- "violates row-level security": Usuário sem permissão para a ação

4. POLÍTICAS DE ACESSO (RLS):
- Usuários só podem ver dados da sua unidade
- Algumas ações requerem perfil específico (contador, financeiro, admin)
- Documentos são vinculados a unidades específicas

5. FLUXOS DO SISTEMA:
- Upload de documentos: PDF ou imagem → OCR → Validação → Salvar
- Contas a pagar: Documento → Dados extraídos → Confirmação → Criar payable
- Fechamento de caixa: Seleção de itens → Conferência → Envelope → Fechamento

INSTRUÇÕES:
- Responda SEMPRE em português brasileiro
- Use linguagem simples e direta
- Explique o que deu errado
- Dê uma sugestão clara de como resolver
- Seja empático e profissional
- Mantenha respostas curtas (2-3 frases)

Formato de resposta JSON:
{
  "title": "Título curto do erro",
  "explanation": "Explicação clara do problema",
  "suggestion": "O que fazer para resolver",
  "severity": "info" | "warning" | "error"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { error_message, context, action_attempted } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const userPrompt = `
Erro encontrado: "${error_message}"
Ação tentada: ${action_attempted || 'Não especificada'}
Contexto: ${JSON.stringify(context || {})}

Por favor, explique este erro de forma clara para o usuário.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        title: "Erro no sistema",
        explanation: content || "Ocorreu um erro inesperado.",
        suggestion: "Tente novamente ou entre em contato com o suporte.",
        severity: "error"
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in explain-error function:', error);
    
    // Fallback response when AI is unavailable
    return new Response(JSON.stringify({
      title: "Erro no processamento",
      explanation: "Não foi possível processar sua solicitação.",
      suggestion: "Verifique os dados e tente novamente.",
      severity: "error"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
