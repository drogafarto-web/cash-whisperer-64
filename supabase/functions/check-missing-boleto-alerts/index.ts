import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NfAguardandoBoleto {
  id: string;
  document_number: string;
  supplier_name: string;
  total_value: number;
  issue_date: string;
  created_at: string;
  unit_id: string;
  dias_aguardando: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting check-missing-boleto-alerts function");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get default alert days from settings (or use 7 as default)
    const { data: settings } = await supabase
      .from("alert_preferences")
      .select("dias_alerta_boleto_ausente, user_id")
      .limit(1)
      .single();

    const diasLimite = settings?.dias_alerta_boleto_ausente || 7;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasLimite);

    console.log(`Checking NFs with aguardando_boleto status older than ${diasLimite} days`);

    // Fetch NFs with status 'aguardando_boleto' older than the limit
    const { data: nfsPendentes, error: nfsError } = await supabase
      .from("supplier_invoices")
      .select(`
        id,
        document_number,
        supplier_name,
        total_value,
        issue_date,
        created_at,
        unit_id
      `)
      .eq("status", "aguardando_boleto")
      .lt("created_at", dataLimite.toISOString());

    if (nfsError) {
      console.error("Error fetching NFs:", nfsError);
      throw nfsError;
    }

    if (!nfsPendentes || nfsPendentes.length === 0) {
      console.log("No NFs pending boleto beyond the limit");
      return new Response(
        JSON.stringify({ message: "No pending NFs found", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${nfsPendentes.length} NFs aguardando boleto`);

    // Calculate days waiting for each NF
    const nfsComDias: NfAguardandoBoleto[] = nfsPendentes.map((nf) => {
      const createdAt = new Date(nf.created_at);
      const hoje = new Date();
      const diasAguardando = Math.floor((hoje.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return { ...nf, dias_aguardando: diasAguardando };
    });

    // Get users with contador or financeiro roles to notify
    const { data: usersToNotify, error: usersError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        profiles!inner(email, name)
      `)
      .in("role", ["contador", "financeiro", "admin"]);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    if (!usersToNotify || usersToNotify.length === 0) {
      console.log("No users to notify");
      return new Response(
        JSON.stringify({ message: "No users to notify", count: nfsPendentes.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;

    // Send email alerts if Resend is configured
    if (resendApiKey) {
      // Dynamic import for Resend
      const { Resend } = await import("https://esm.sh/resend@2.0.0");
      const resend = new Resend(resendApiKey);
      
      // Group NFs by urgency
      const critico = nfsComDias.filter(nf => nf.dias_aguardando > 14);
      const alerta = nfsComDias.filter(nf => nf.dias_aguardando >= 7 && nf.dias_aguardando <= 14);

      const formatCurrency = (value: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

      const generateNfList = (nfs: NfAguardandoBoleto[]) => 
        nfs.map(nf => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${nf.document_number}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${nf.supplier_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${formatCurrency(nf.total_value)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${nf.dias_aguardando} dias</td>
          </tr>
        `).join('');

      for (const user of usersToNotify) {
        const profile = (user as any).profiles;
        if (!profile?.email) continue;

        const emailHtml = `
          <h2>Alerta: NFs Aguardando Boleto</h2>
          <p>Olá ${profile.name || 'Usuário'},</p>
          <p>Existem <strong>${nfsPendentes.length}</strong> notas fiscais aguardando boleto há mais de ${diasLimite} dias.</p>
          
          ${critico.length > 0 ? `
            <h3 style="color: #dc2626;">⚠️ Crítico (mais de 14 dias):</h3>
            <table style="border-collapse: collapse; width: 100%;">
              <tr style="background: #fee2e2;">
                <th style="padding: 8px; border: 1px solid #ddd;">Nº NF</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Fornecedor</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Valor</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Aguardando</th>
              </tr>
              ${generateNfList(critico)}
            </table>
          ` : ''}
          
          ${alerta.length > 0 ? `
            <h3 style="color: #f59e0b;">⏳ Alerta (7-14 dias):</h3>
            <table style="border-collapse: collapse; width: 100%;">
              <tr style="background: #fef3c7;">
                <th style="padding: 8px; border: 1px solid #ddd;">Nº NF</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Fornecedor</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Valor</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Aguardando</th>
              </tr>
              ${generateNfList(alerta)}
            </table>
          ` : ''}
          
          <p style="margin-top: 20px;">
            <a href="${Deno.env.get("SITE_URL") || "https://labclin.lovable.app"}/payables/supplier-invoices" 
               style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
              Acessar Sistema
            </a>
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Este é um email automático. Por favor, não responda.
          </p>
        `;

        try {
          await resend.emails.send({
            from: "LabClin <onboarding@resend.dev>",
            to: [profile.email],
            subject: `[Alerta] ${nfsPendentes.length} NFs aguardando boleto há mais de ${diasLimite} dias`,
            html: emailHtml,
          });
          console.log(`Email sent to ${profile.email}`);
          emailsSent++;
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.email}:`, emailError);
        }
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
    }

    // Log the alert in the database
    await supabase.from("app_error_logs").insert({
      error_message: `Check missing boleto alerts: ${nfsPendentes.length} NFs aguardando boleto`,
      metadata: {
        type: "missing_boleto_alert",
        count: nfsPendentes.length,
        nfs: nfsComDias.map(nf => ({
          id: nf.id,
          document_number: nf.document_number,
          dias_aguardando: nf.dias_aguardando,
        })),
      },
    });

    return new Response(
      JSON.stringify({ 
        message: "Alerts processed successfully", 
        count: nfsPendentes.length,
        emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in check-missing-boleto-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
