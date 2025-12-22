import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserAlertData {
  userId: string;
  unitId?: string;
  fatorR: number;
  preferences: {
    email_fator_r_critico: boolean;
    email_fator_r_alerta: boolean;
    limite_alerta_preventivo: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting Fator R alert check...");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with alert preferences enabled
    const { data: preferences, error: prefError } = await supabase
      .from('alert_preferences')
      .select('*')
      .or('email_fator_r_critico.eq.true,email_fator_r_alerta.eq.true');

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log('No users with alert preferences enabled');
      return new Response(JSON.stringify({ message: 'No users to check' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${preferences.length} users with alert preferences`);

    const alertsSent: any[] = [];

    // For each user, calculate their Fator R and check if alert is needed
    for (const pref of preferences) {
      try {
        console.log(`Processing user: ${pref.user_id}`);

        // Get user's unit
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', pref.user_id)
          .single();

        const unitId = profile?.unit_id;

        // Get last 12 months of payroll and revenue data
        const now = new Date();
        const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);

        // Get seed payroll data
        const { data: payrollData } = await supabase
          .from('seed_payroll')
          .select('*')
          .gte('ano', startDate.getFullYear());

        // Get seed revenue data
        const { data: revenueData } = await supabase
          .from('seed_revenue')
          .select('*')
          .gte('ano', startDate.getFullYear());

        if (!payrollData?.length || !revenueData?.length) {
          console.log(`No data for user ${pref.user_id}`);
          continue;
        }

        // Calculate Fator R
        let folha12 = 0;
        let rbt12 = 0;

        payrollData.forEach(p => {
          folha12 += Number(p.salarios) + Number(p.prolabore) + Number(p.inss_patronal) + Number(p.fgts);
        });

        revenueData.forEach(r => {
          rbt12 += Number(r.receita_servicos) + Number(r.receita_outras);
        });

        const fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;

        console.log(`User ${pref.user_id}: Fator R = ${(fatorR * 100).toFixed(1)}%`);

        // Check if we need to send an alert
        let tipoAlerta: string | null = null;

        if (fatorR < 0.28 && pref.email_fator_r_critico) {
          tipoAlerta = 'CAIU_ABAIXO_28';
        } else if (fatorR < pref.limite_alerta_preventivo && fatorR >= 0.28 && pref.email_fator_r_alerta) {
          tipoAlerta = 'CAIU_ABAIXO_30';
        }

        if (!tipoAlerta) {
          console.log(`No alert needed for user ${pref.user_id}`);
          continue;
        }

        // Check if we already sent this type of alert recently (last 24 hours)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAlerts } = await supabase
          .from('fator_r_alerts')
          .select('id')
          .eq('user_id', pref.user_id)
          .eq('tipo_alerta', tipoAlerta)
          .gte('created_at', yesterday)
          .limit(1);

        if (recentAlerts && recentAlerts.length > 0) {
          console.log(`Recent alert already sent for user ${pref.user_id}`);
          continue;
        }

        // Calculate adjustment needed
        const targetFolha = rbt12 * 0.28;
        const ajusteSugerido = Math.max(0, targetFolha - folha12);
        
        // Estimate savings (rough calculation)
        const receitaMensal = rbt12 / 12;
        const impostoAnexo5 = receitaMensal * 0.155;
        const impostoAnexo3 = receitaMensal * 0.06;
        const economiaPotencial = impostoAnexo5 - impostoAnexo3;

        // Send alert via the send-fator-r-alert function
        const { error: alertError } = await supabase.functions.invoke('send-fator-r-alert', {
          body: {
            userId: pref.user_id,
            unitId,
            fatorRAtual: fatorR,
            tipoAlerta,
            ajusteSugerido,
            economiaPotencial,
          },
        });

        if (alertError) {
          console.error(`Error sending alert for user ${pref.user_id}:`, alertError);
        } else {
          console.log(`Alert sent successfully for user ${pref.user_id}`);
          alertsSent.push({ userId: pref.user_id, tipoAlerta, fatorR });
        }
      } catch (userError) {
        console.error(`Error processing user ${pref.user_id}:`, userError);
      }
    }

    console.log(`Completed. Sent ${alertsSent.length} alerts.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsSent: alertsSent.length,
        details: alertsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-fator-r-alerts function:", error);
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
