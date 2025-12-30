import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o assistente virtual do LabClin, um sistema completo de gestão para laboratórios de análises clínicas.
Você ajuda os usuários a entender e usar o sistema de forma eficiente.

## MÓDULOS DO SISTEMA:

### 1. PAINEL DE CONTABILIDADE
- Upload inteligente de documentos tributários (DAS, DARF, GPS, INSS, FGTS, ISS)
- Processamento automático com OCR e IA
- Extração de valores, vencimentos e competências
- Criação automática de contas a pagar
- Histórico de documentos por competência (mês/ano)

### 2. CONTAS A PAGAR
- Cadastro de boletos e notas fiscais de fornecedores
- Vinculação NF + Boleto
- Alertas de vencimento
- Baixa de pagamentos
- Dashboard de pendências

### 3. FATURAMENTO (NOTAS FISCAIS)
- Cadastro de tomadores de serviço
- Emissão e gestão de notas fiscais
- Controle de recebimentos
- Relatórios por período

### 4. FECHAMENTO DE CAIXA
- Importação de dados do LIS (Sistema de Laboratório)
- Seleção de atendimentos para fechamento
- Envelope de dinheiro com etiqueta
- Conferência e diferenças
- Fechamento diário

### 5. RELATÓRIOS
- Fluxo de caixa projetado
- Cenários tributários (Simples Nacional)
- Fator R e otimização fiscal
- Fechamentos por período

### 6. CONFIGURAÇÕES
- Unidades do laboratório
- Contas bancárias
- Categorias de despesa/receita
- Usuários e permissões
- Convênios

## FLUXOS PRINCIPAIS:

### Upload de Documento Tributário:
1. Acesse "Contabilidade" → "Painel"
2. Arraste o arquivo PDF ou imagem na área de upload
3. A IA analisa e extrai os dados automaticamente
4. Confira os valores e clique "Aplicar"
5. Opcionalmente, crie uma conta a pagar

### Criar Conta a Pagar:
1. Acesse "Contas a Pagar" → "Boletos"
2. Clique em "Novo Boleto"
3. Faça upload do boleto ou preencha manualmente
4. Vincule a uma NF se aplicável
5. Salve

### Fechamento de Caixa:
1. Importe os dados do LIS (movimento diário)
2. Selecione os atendimentos pagos em dinheiro
3. Gere o envelope e imprima a etiqueta
4. Confira o valor e registre diferenças se houver
5. Confirme o fechamento

## TIPOS DE DOCUMENTO ACEITOS:
- PDF (recomendado)
- Imagens: JPG, PNG, WebP
- Tamanho máximo: 10MB

## COMPETÊNCIA:
- Período ao qual o documento se refere
- Formato: Mês/Ano (ex: 11/2025)
- Anos permitidos: 2020 a 2099

## PERFIS DE USUÁRIO:
- Admin: Acesso total
- Contador: Contabilidade e relatórios fiscais
- Financeiro: Contas a pagar/receber, fechamentos
- Atendente: Recepção e fechamento de caixa

INSTRUÇÕES:
- Responda SEMPRE em português brasileiro
- Seja claro, objetivo e amigável
- Dê exemplos práticos quando apropriado
- Se não souber algo específico, indique que o usuário pode contatar o suporte
- Mantenha respostas concisas mas completas`;

serve(async (req) => {
  console.log('[help-assistant] Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, user_context } = await req.json();
    console.log('[help-assistant] Messages count:', messages?.length);
    console.log('[help-assistant] User context:', JSON.stringify(user_context));
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[help-assistant] OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build context-aware system prompt
    let contextInfo = '';
    if (user_context) {
      contextInfo = `\n\nCONTEXTO DO USUÁRIO:
- Página atual: ${user_context.current_page || 'Não especificada'}
- Perfil: ${user_context.role || 'Não especificado'}
- Unidade: ${user_context.unit || 'Não especificada'}`;
    }

    console.log('[help-assistant] Calling OpenAI API...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextInfo },
          ...messages
        ],
        temperature: 0.5,
        max_tokens: 500,
        stream: true,
      }),
    });

    console.log('[help-assistant] OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[help-assistant] OpenAI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Limite de requisições excedido. Tente novamente em alguns minutos.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 401) {
        return new Response(JSON.stringify({
          error: 'Chave de API inválida. Contate o administrador.'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    console.log('[help-assistant] Streaming response to client...');
    
    // Stream the response
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('[help-assistant] Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Desculpe, não consegui processar sua pergunta. Tente novamente.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
