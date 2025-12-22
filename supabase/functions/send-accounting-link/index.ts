import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendLinkRequest {
  contact_id: string;
  tipo: "mensal" | "historico";
  ano?: number;
  mes?: number;
  ano_inicio?: number;
  mes_inicio?: number;
  ano_fim?: number;
  mes_fim?: number;
}

const MONTH_NAMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getMonthName(mes: number): string {
  return MONTH_NAMES[mes] || "";
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

    const body: SendLinkRequest = await req.json();
    console.log("Request body:", body);

    // Validate required fields
    if (!body.contact_id) {
      throw new Error("contact_id é obrigatório");
    }

    // Fetch contact info
    const { data: contact, error: contactError } = await supabase
      .from("accounting_contacts")
      .select("*")
      .eq("id", body.contact_id)
      .single();

    if (contactError || !contact) {
      console.error("Contact error:", contactError);
      throw new Error("Contato da contabilidade não encontrado");
    }

    console.log("Contact found:", contact.nome, contact.email);

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    // Prepare token record
    const tokenRecord: any = {
      token,
      tipo: body.tipo,
      expires_at: expiresAt.toISOString(),
      contact_id: body.contact_id,
    };

    // Set appropriate fields based on type
    if (body.tipo === "mensal") {
      if (!body.ano || !body.mes) {
        throw new Error("ano e mes são obrigatórios para tipo mensal");
      }
      tokenRecord.ano = body.ano;
      tokenRecord.mes = body.mes;
    } else if (body.tipo === "historico") {
      tokenRecord.ano_inicio = body.ano_inicio || 2024;
      tokenRecord.mes_inicio = body.mes_inicio || 11;
      tokenRecord.ano_fim = body.ano_fim || 2025;
      tokenRecord.mes_fim = body.mes_fim || 12;
    }

    // Insert token
    const { data: tokenData, error: tokenError } = await supabase
      .from("accounting_tokens")
      .insert(tokenRecord)
      .select()
      .single();

    if (tokenError) {
      console.error("Token insert error:", tokenError);
      throw new Error("Erro ao criar token de acesso");
    }

    console.log("Token created:", tokenData.id);

    // Build form URL
    const appUrl = Deno.env.get("APP_URL") || `https://${Deno.env.get("SUPABASE_PROJECT_REF")}.lovable.app`;
    const formUrl = `${appUrl}/contabilidade/dados/${token}`;

    // Prepare email content
    let subject: string;
    let periodText: string;
    let instructionText: string;

    if (body.tipo === "mensal") {
      subject = `Dados consolidados de ${getMonthName(body.mes!)}/${body.ano} – Labclin`;
      periodText = `${getMonthName(body.mes!)}/${body.ano}`;
      instructionText = `precisamos dos valores consolidados de ${periodText}`;
    } else {
      subject = `Dados históricos Nov/2024 a Dez/2025 – Labclin`;
      periodText = "Nov/2024 a Dez/2025";
      instructionText = `precisamos dos valores históricos do período ${periodText} (14 meses)`;
    }

    // Send email using Resend
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
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Portal da Contabilidade</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${contact.nome}</strong>,</p>
          
          <p>Para calcular corretamente o <strong>Fator R</strong> e os cenários tributários do laboratório, ${instructionText}:</p>
          
          <ul style="list-style: none; padding: 0; margin: 20px 0;">
            <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
              <span style="color: #667eea;">📋</span> Folha de pagamento (salários, pró-labore, encargos)
            </li>
            <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
              <span style="color: #667eea;">💰</span> Receita de serviços do laboratório
            </li>
            <li style="padding: 8px 0;">
              <span style="color: #667eea;">🧾</span> Impostos pagos (DAS, ISS, IRRF e outros)
            </li>
          </ul>
          
          <p>Você pode informar esses valores em um <strong>formulário seguro</strong> no link abaixo:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              👉 Acessar formulário de ${periodText}
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Este link é válido por <strong>30 dias</strong>. Assim que os dados forem enviados, 
            o sistema atualizará automaticamente os relatórios e cenários tributários.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; margin: 0;">
            Atenciosamente,<br>
            <strong>Labclin Finance</strong><br>
            <em>Sistema de Gestão Financeira</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Labclin Finance <onboarding@resend.dev>",
      to: [contact.email],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent:", emailResponse);

    // Log email
    await supabase.from("accounting_email_logs").insert({
      token_id: tokenData.id,
      contact_id: body.contact_id,
      email_to: contact.email,
      subject: subject,
      status: "sent",
    });

    return new Response(
      JSON.stringify({
        success: true,
        token_id: tokenData.id,
        email_sent_to: contact.email,
        form_url: formUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-accounting-link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
