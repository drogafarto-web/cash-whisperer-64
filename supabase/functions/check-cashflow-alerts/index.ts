import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CashflowWeek {
  weekStart: Date;
  closingBalance: number;
  status: 'POSITIVO' | 'BAIXO' | 'NEGATIVO';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting cashflow alert check...");

    // Get units
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select("id, name");

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      throw unitsError;
    }

    const alerts: Array<{ unitId: string; unitName: string; weekStart: Date; balance: number }> = [];

    for (const unit of units || []) {
      // Get last cash closing balance
      const { data: lastClosing } = await supabase
        .from("cash_closings")
        .select("actual_balance")
        .eq("unit_id", unit.id)
        .order("date", { ascending: false })
        .limit(1);

      const currentBalance = lastClosing?.[0]?.actual_balance || 0;

      // Get pending payables for next 4 weeks
      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);

      const { data: payables } = await supabase
        .from("payables")
        .select("valor, vencimento")
        .eq("unit_id", unit.id)
        .eq("status", "PENDENTE")
        .gte("vencimento", new Date().toISOString().split("T")[0])
        .lte("vencimento", fourWeeksFromNow.toISOString().split("T")[0]);

      // Get pending invoices (expected receipts)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("net_value, issue_date")
        .eq("unit_id", unit.id)
        .eq("status", "ABERTA")
        .is("received_at", null);

      // Simple projection: calculate running balance
      let runningBalance = Number(currentBalance);
      const totalPayables = (payables || []).reduce((sum, p) => sum + Number(p.valor), 0);
      const totalInvoices = (invoices || []).reduce((sum, i) => sum + Number(i.net_value), 0);

      // Estimate: invoices received over 4 weeks, payables paid when due
      const projectedBalance = runningBalance + (totalInvoices * 0.5) - totalPayables;

      console.log(`Unit ${unit.name}: Current ${currentBalance}, Payables ${totalPayables}, Projected ${projectedBalance}`);

      if (projectedBalance < 0) {
        alerts.push({
          unitId: unit.id,
          unitName: unit.name,
          weekStart: new Date(),
          balance: projectedBalance,
        });

        // Save alert to database
        await supabase.from("cashflow_alerts").insert({
          unit_id: unit.id,
          week_start: new Date().toISOString().split("T")[0],
          projected_balance: projectedBalance,
          alert_type: "NEGATIVO",
        });
      }
    }

    console.log(`Found ${alerts.length} units with negative cashflow projection`);

    // Send email if there are alerts
    if (alerts.length > 0 && resendApiKey) {
      // Get admin users
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, name")
          .in("id", adminRoles.map((r) => r.user_id));

        for (const profile of profiles || []) {
          const alertsHtml = alerts
            .map(
              (a) =>
                `<tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.unitName}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;">R$ ${a.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>`
            )
            .join("");

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">⚠️ Alerta de Fluxo de Caixa</h2>
              <p>Olá ${profile.name},</p>
              <p>Detectamos projeções de saldo negativo nas seguintes unidades:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; text-align: left;">Unidade</th>
                    <th style="padding: 8px; text-align: left;">Saldo Projetado</th>
                  </tr>
                </thead>
                <tbody>
                  ${alertsHtml}
                </tbody>
              </table>
              
              <p><strong>Ações sugeridas:</strong></p>
              <ul>
                <li>Antecipar recebíveis pendentes</li>
                <li>Renegociar vencimentos de boletos</li>
                <li>Revisar despesas não essenciais</li>
              </ul>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Este é um alerta automático do sistema LabClin Controle.
              </p>
            </div>
          `;

          try {
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "LabClin Controle <alertas@labclin.com.br>",
                to: profile.email,
                subject: `⚠️ Alerta: ${alerts.length} unidade(s) com fluxo de caixa negativo`,
                html: emailHtml,
              }),
            });

            if (emailResponse.ok) {
              console.log(`Email sent to ${profile.email}`);
            } else {
              const errorText = await emailResponse.text();
              console.error(`Failed to send email to ${profile.email}:`, errorText);
            }
          } catch (emailError) {
            console.error(`Error sending email to ${profile.email}:`, emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsCount: alerts.length,
        alerts: alerts.map((a) => ({
          unitName: a.unitName,
          projectedBalance: a.balance,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in check-cashflow-alerts:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
