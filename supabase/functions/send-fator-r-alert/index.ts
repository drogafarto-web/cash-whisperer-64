import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  test?: boolean;
  userId: string;
  unitId?: string;
  fatorRAtual: number;
  fatorRAnterior?: number;
  tipoAlerta: 'CAIU_ABAIXO_30' | 'CAIU_ABAIXO_28' | 'SUBIU_ACIMA_28' | 'SUBIU_ACIMA_30';
  ajusteSugerido?: number;
  economiaPotencial?: number;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

const getAlertTitle = (tipo: string) => {
  switch (tipo) {
    case 'CAIU_ABAIXO_28':
      return '🚨 ALERTA CRÍTICO: Fator R abaixo de 28%';
    case 'CAIU_ABAIXO_30':
      return '⚠️ ALERTA PREVENTIVO: Fator R próximo do limite';
    case 'SUBIU_ACIMA_28':
      return '✅ ÓTIMA NOTÍCIA: Fator R acima de 28%';
    case 'SUBIU_ACIMA_30':
      return '🎉 EXCELENTE: Fator R na zona segura';
    default:
      return '📊 Atualização do Fator R';
  }
};

const getAlertColor = (tipo: string) => {
  switch (tipo) {
    case 'CAIU_ABAIXO_28':
      return '#ef4444';
    case 'CAIU_ABAIXO_30':
      return '#f59e0b';
    case 'SUBIU_ACIMA_28':
    case 'SUBIU_ACIMA_30':
      return '#22c55e';
    default:
      return '#6366f1';
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AlertRequest = await req.json();
    const { test, userId, unitId, fatorRAtual, fatorRAnterior, tipoAlerta, ajusteSugerido, economiaPotencial } = body;

    console.log('Received alert request:', { userId, tipoAlerta, fatorRAtual, test });

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      throw new Error('Usuário não encontrado');
    }

    console.log('Sending email to:', profile.email);

    // Get unit name if available
    let unitName = 'Sua empresa';
    if (unitId) {
      const { data: unit } = await supabase
        .from('units')
        .select('name')
        .eq('id', unitId)
        .single();
      if (unit) unitName = unit.name;
    }

    const alertColor = getAlertColor(tipoAlerta);
    const isNegative = tipoAlerta.includes('ABAIXO');
    const anexoAtual = fatorRAtual >= 0.28 ? 'III' : 'V';
    const aliquotaAtual = anexoAtual === 'III' ? '~6%' : '~15,5%';

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; margin: 0;">🔬 CliniLab Finance</h1>
          </div>

          <div style="background: ${alertColor}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0;">${getAlertTitle(tipoAlerta)}</h2>
          </div>

          <p>Olá <strong>${profile.name || 'Gestor'}</strong>,</p>

          <p>O Fator R de <strong>${unitName}</strong> ${isNegative ? 'caiu para' : 'subiu para'} <strong>${formatPercent(fatorRAtual)}</strong>${fatorRAnterior ? ` (anterior: ${formatPercent(fatorRAnterior)})` : ''}.</p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #475569;">📊 Situação Atual</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Fator R</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: ${alertColor};">${formatPercent(fatorRAtual)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Meta</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">≥ 28%</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Anexo Atual</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${anexoAtual}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Alíquota Inicial</td>
                <td style="padding: 8px 0; text-align: right;">${aliquotaAtual}</td>
              </tr>
            </table>
          </div>

          ${isNegative && ajusteSugerido ? `
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #92400e;">💡 Ação Recomendada</h3>
            <p style="margin: 0 0 10px 0;">
              <strong>Aumente o pró-labore em ${formatCurrency(ajusteSugerido / 12)}/mês</strong>
            </p>
            ${economiaPotencial ? `
            <p style="margin: 0; color: #166534;">
              <strong>Economia potencial: ${formatCurrency(economiaPotencial)}/mês</strong>
            </p>
            ` : ''}
          </div>
          ` : ''}

          ${!isNegative ? `
          <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">✅ Parabéns!</h3>
            <p style="margin: 0;">Você está aproveitando os benefícios do Anexo III com alíquotas menores.</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://xyojxxvkednngukibadw.lovableproject.com/reports/tax-scenarios" 
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Ver Cenários Tributários
            </a>
          </div>

          ${test ? `
          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              📧 Este é um email de teste. Em produção, você receberá alertas reais quando o Fator R se aproximar de limites críticos.
            </p>
          </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #64748b; font-size: 12px; text-align: center;">
            Para alterar suas preferências de notificação, acesse Cenários Tributários > Configurações de Alertas.
            <br><br>
            CliniLab Finance - Gestão Tributária Inteligente
          </p>
        </body>
      </html>
    `;

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "CliniLab Finance <onboarding@resend.dev>",
        to: [profile.email],
        subject: getAlertTitle(tipoAlerta),
        html: emailHtml,
      }),
    });

    const emailResponse = await resendResponse.json();

    console.log("Email sent successfully:", emailResponse);

    // Log the alert (only if not a test)
    if (!test) {
      const { error: insertError } = await supabase
        .from('fator_r_alerts')
        .insert({
          user_id: userId,
          unit_id: unitId,
          fator_r_atual: fatorRAtual,
          fator_r_anterior: fatorRAnterior,
          tipo_alerta: tipoAlerta,
          ajuste_sugerido: ajusteSugerido,
          economia_potencial: economiaPotencial,
          email_enviado: true,
          email_enviado_em: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error logging alert:', insertError);
      }
    }

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-fator-r-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
