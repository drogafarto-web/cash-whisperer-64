import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getMonthName(mes: number): string {
  return MONTH_NAMES[mes] || "";
}

function getPreviousMonth(): { ano: number; mes: number } {
  const now = new Date();
  let mes = now.getMonth(); // 0-indexed, so this is previous month
  let ano = now.getFullYear();
  
  if (mes === 0) {
    mes = 12;
    ano -= 1;
  }
  
  return { ano, mes };
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read settings from database
    const { data: settings, error: settingsError } = await supabase
      .from("accounting_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.log("No settings found, using defaults");
    }

    // Settings with defaults
    const reminderDay = settings?.reminder_day || 5;
    const reminderHour = settings?.reminder_hour || 8;
    
    console.log(`Reminder configured for day ${reminderDay} at ${reminderHour}:00 BRT`);

    const { ano, mes } = getPreviousMonth();
    console.log(`Checking data for ${mes}/${ano}`);

    // Check if we have data for the previous month
    const { data: revenueData } = await supabase
      .from("seed_revenue")
      .select("*")
      .eq("ano", ano)
      .eq("mes", mes)
      .single();

    const { data: payrollData } = await supabase
      .from("seed_payroll")
      .select("*")
      .eq("ano", ano)
      .eq("mes", mes)
      .single();

    const { data: taxesData } = await supabase
      .from("seed_taxes")
      .select("*")
      .eq("ano", ano)
      .eq("mes", mes)
      .single();

    // Check if data is complete (at least revenue and payroll)
    const hasRevenue = revenueData && revenueData.receita_servicos > 0;
    const hasPayroll = payrollData && (payrollData.salarios > 0 || payrollData.prolabore > 0);
    
    if (hasRevenue && hasPayroll) {
      console.log(`Data already complete for ${mes}/${ano}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Dados já estão completos para ${getMonthName(mes)}/${ano}`,
          data_found: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Missing data for ${mes}/${ano}, sending reminders`);

    // Get all active accounting contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("accounting_contacts")
      .select("*")
      .eq("ativo", true);

    if (contactsError || !contacts || contacts.length === 0) {
      console.log("No active accounting contacts found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum contato de contabilidade ativo encontrado",
          emails_sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let emailsSent = 0;

    for (const contact of contacts) {
      try {
        // Generate token
        const token = generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Insert token
        const { data: tokenData, error: tokenError } = await supabase
          .from("accounting_tokens")
          .insert({
            token,
            tipo: "mensal",
            ano,
            mes,
            expires_at: expiresAt.toISOString(),
            contact_id: contact.id,
          })
          .select()
          .single();

        if (tokenError) {
          console.error("Token insert error:", tokenError);
          continue;
        }

        // Build form URL
        const appUrl = Deno.env.get("APP_URL") || `https://${Deno.env.get("SUPABASE_PROJECT_REF")}.lovable.app`;
        const formUrl = `${appUrl}/contabilidade/dados/${token}`;
        const periodText = `${getMonthName(mes)}/${ano}`;

        // Send email
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📊 Labclin Finance</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Lembrete Mensal</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${contact.nome}</strong>,</p>
              
              <p>Este é um lembrete para enviar os dados consolidados de <strong>${periodText}</strong> para o cálculo do Fator R e cenários tributários.</p>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  ⚠️ Os dados de <strong>${periodText}</strong> ainda não foram recebidos.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  👉 Preencher dados de ${periodText}
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Link válido por <strong>30 dias</strong>.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; margin: 0;">
                Atenciosamente,<br>
                <strong>Labclin Finance</strong>
              </p>
            </div>
          </body>
          </html>
        `;

        await resend.emails.send({
          from: "Labclin Finance <onboarding@resend.dev>",
          to: [contact.email],
          subject: `[Lembrete] Dados de ${periodText} pendentes – Labclin`,
          html: emailHtml,
        });

        // Log email
        await supabase.from("accounting_email_logs").insert({
          token_id: tokenData.id,
          contact_id: contact.id,
          email_to: contact.email,
          subject: `[Lembrete] Dados de ${periodText} pendentes – Labclin`,
          status: "sent",
        });

        emailsSent++;
        console.log(`Reminder sent to ${contact.email}`);
      } catch (contactError: any) {
        console.error(`Error sending to ${contact.email}:`, contactError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lembretes enviados para ${emailsSent} contato(s)`,
        emails_sent: emailsSent,
        month_checked: `${mes}/${ano}`,
        settings_used: {
          reminder_day: reminderDay,
          reminder_hour: reminderHour,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in monthly-accounting-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
