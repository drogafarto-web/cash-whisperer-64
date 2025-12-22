import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MonthData {
  ano: number;
  mes: number;
  // Receita
  receita_servicos: number;
  receita_outras: number;
  // Folha
  salarios: number;
  prolabore: number;
  inss_patronal: number;
  fgts: number;
  decimo_terceiro: number;
  ferias: number;
  // Impostos
  das: number;
  iss_proprio: number;
  iss_retido: number;
  irrf_retido: number;
  outros: number;
}

interface SaveDataRequest {
  token: string;
  data: MonthData[];
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

    const body: SaveDataRequest = await req.json();
    console.log("Request received for token:", body.token?.substring(0, 8) + "...");

    if (!body.token) {
      throw new Error("Token é obrigatório");
    }

    if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
      throw new Error("Dados são obrigatórios");
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("accounting_tokens")
      .select("*")
      .eq("token", body.token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token error:", tokenError);
      throw new Error("Token inválido ou não encontrado");
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error("Token expirado");
    }

    // Check if already used (for mensal type)
    if (tokenData.tipo === "mensal" && tokenData.used_at) {
      throw new Error("Este link já foi utilizado");
    }

    console.log("Token validated, processing", body.data.length, "months of data");

    // Process each month's data
    const errors: string[] = [];
    let savedCount = 0;

    for (const monthData of body.data) {
      try {
        // Validate basic data
        if (!monthData.ano || !monthData.mes) {
          errors.push(`Dados incompletos para um mês`);
          continue;
        }

        // Check if receita_servicos is provided (mandatory)
        if (monthData.receita_servicos === undefined || monthData.receita_servicos < 0) {
          errors.push(`Receita de serviços é obrigatória para ${monthData.mes}/${monthData.ano}`);
          continue;
        }

        // Upsert seed_revenue
        const { error: revenueError } = await supabase
          .from("seed_revenue")
          .upsert({
            ano: monthData.ano,
            mes: monthData.mes,
            receita_servicos: monthData.receita_servicos || 0,
            receita_outras: monthData.receita_outras || 0,
          }, { onConflict: "ano,mes" });

        if (revenueError) {
          console.error("Revenue upsert error:", revenueError);
          // Try insert if upsert fails
          await supabase.from("seed_revenue").insert({
            ano: monthData.ano,
            mes: monthData.mes,
            receita_servicos: monthData.receita_servicos || 0,
            receita_outras: monthData.receita_outras || 0,
          });
        }

        // Upsert seed_payroll
        const { error: payrollError } = await supabase
          .from("seed_payroll")
          .upsert({
            ano: monthData.ano,
            mes: monthData.mes,
            salarios: monthData.salarios || 0,
            prolabore: monthData.prolabore || 0,
            inss_patronal: monthData.inss_patronal || 0,
            fgts: monthData.fgts || 0,
            decimo_terceiro: monthData.decimo_terceiro || 0,
            ferias: monthData.ferias || 0,
          }, { onConflict: "ano,mes" });

        if (payrollError) {
          console.error("Payroll upsert error:", payrollError);
          await supabase.from("seed_payroll").insert({
            ano: monthData.ano,
            mes: monthData.mes,
            salarios: monthData.salarios || 0,
            prolabore: monthData.prolabore || 0,
            inss_patronal: monthData.inss_patronal || 0,
            fgts: monthData.fgts || 0,
            decimo_terceiro: monthData.decimo_terceiro || 0,
            ferias: monthData.ferias || 0,
          });
        }

        // Upsert seed_taxes
        const { error: taxesError } = await supabase
          .from("seed_taxes")
          .upsert({
            ano: monthData.ano,
            mes: monthData.mes,
            das: monthData.das || 0,
            iss_proprio: monthData.iss_proprio || 0,
            iss_retido: monthData.iss_retido || 0,
            irrf_retido: monthData.irrf_retido || 0,
            outros: monthData.outros || 0,
          }, { onConflict: "ano,mes" });

        if (taxesError) {
          console.error("Taxes upsert error:", taxesError);
          await supabase.from("seed_taxes").insert({
            ano: monthData.ano,
            mes: monthData.mes,
            das: monthData.das || 0,
            iss_proprio: monthData.iss_proprio || 0,
            iss_retido: monthData.iss_retido || 0,
            irrf_retido: monthData.irrf_retido || 0,
            outros: monthData.outros || 0,
          });
        }

        savedCount++;
        console.log(`Saved data for ${monthData.mes}/${monthData.ano}`);
      } catch (monthError: any) {
        console.error(`Error saving month ${monthData.mes}/${monthData.ano}:`, monthError);
        errors.push(`Erro ao salvar ${monthData.mes}/${monthData.ano}: ${monthError.message}`);
      }
    }

    // Mark token as used
    await supabase
      .from("accounting_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    console.log("Token marked as used");

    return new Response(
      JSON.stringify({
        success: true,
        saved_months: savedCount,
        total_months: body.data.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Dados salvos com sucesso para ${savedCount} mês(es)`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in save-accounting-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
