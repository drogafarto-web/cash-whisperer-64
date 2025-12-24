import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayableAlert {
  id: string;
  beneficiario: string | null;
  valor: number;
  vencimento: string;
  unit_id: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[check-payable-alerts] Starting alert check...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('[check-payable-alerts] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range: today to 3 days from now
    const today = new Date();
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const todayStr = today.toISOString().split('T')[0];
    const in3DaysStr = in3Days.toISOString().split('T')[0];

    console.log(`[check-payable-alerts] Checking payables due between ${todayStr} and ${in3DaysStr}`);

    // Fetch payables due in the next 3 days
    const { data: payables, error: payablesError } = await supabase
      .from('payables')
      .select('id, beneficiario, valor, vencimento, unit_id')
      .in('status', ['pendente', 'vencido'])
      .gte('vencimento', todayStr)
      .lte('vencimento', in3DaysStr)
      .order('vencimento', { ascending: true });

    if (payablesError) {
      console.error('[check-payable-alerts] Error fetching payables:', payablesError);
      throw payablesError;
    }

    console.log(`[check-payable-alerts] Found ${payables?.length || 0} payables due soon`);

    if (!payables || payables.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No payables due in the next 3 days', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch admin users to notify
    const { data: adminUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, name, unit_id');

    if (usersError) {
      console.error('[check-payable-alerts] Error fetching users:', usersError);
      throw usersError;
    }

    // Group payables by unit
    const payablesByUnit = new Map<string | null, PayableAlert[]>();
    for (const p of payables) {
      const unitId = p.unit_id;
      const existing = payablesByUnit.get(unitId) || [];
      existing.push(p);
      payablesByUnit.set(unitId, existing);
    }

    // Generate and send emails
    let emailsSent = 0;
    const errors: string[] = [];

    // For now, send to all admin users
    for (const user of adminUsers || []) {
      // Get payables for this user's unit (or all if no unit)
      const userPayables = user.unit_id 
        ? payablesByUnit.get(user.unit_id) || []
        : payables;

      if (userPayables.length === 0) continue;

      const totalValue = userPayables.reduce((sum, p) => sum + p.valor, 0);
      const formatCurrency = (value: number) => 
        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      // Generate email HTML
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .summary { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626; }
    .payable-list { background: white; border-radius: 8px; overflow: hidden; }
    .payable-item { padding: 15px; border-bottom: 1px solid #e5e7eb; }
    .payable-item:last-child { border-bottom: none; }
    .payable-name { font-weight: bold; margin-bottom: 5px; }
    .payable-details { color: #6b7280; font-size: 14px; }
    .payable-value { float: right; font-weight: bold; color: #dc2626; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Boletos a Vencer</h1>
    </div>
    <div class="content">
      <div class="summary">
        <strong>${userPayables.length} boleto${userPayables.length > 1 ? 's' : ''}</strong> vencem nos próximos 3 dias<br>
        <strong>Total: ${formatCurrency(totalValue)}</strong>
      </div>
      
      <div class="payable-list">
        ${userPayables.map(p => {
          const dueDate = new Date(p.vencimento);
          const dueDateStr = dueDate.toLocaleDateString('pt-BR');
          const isToday = p.vencimento === todayStr;
          const isTomorrow = p.vencimento === new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const urgency = isToday ? '🔴 HOJE' : isTomorrow ? '🟠 Amanhã' : '🟡 ' + dueDateStr;
          
          return `
            <div class="payable-item">
              <span class="payable-value">${formatCurrency(p.valor)}</span>
              <div class="payable-name">${p.beneficiario || 'Beneficiário não informado'}</div>
              <div class="payable-details">${urgency}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="footer">
        <p>Este é um email automático do sistema de gestão financeira.</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      // Send email via Resend
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Alertas <alertas@labclin.app>',
            to: [user.email],
            subject: `⚠️ ${userPayables.length} boleto${userPayables.length > 1 ? 's' : ''} vencem nos próximos 3 dias`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`[check-payable-alerts] Error sending email to ${user.email}:`, errorText);
          errors.push(`Failed to send to ${user.email}: ${errorText}`);
        } else {
          console.log(`[check-payable-alerts] Email sent to ${user.email}`);
          emailsSent++;
        }
      } catch (emailError) {
        console.error(`[check-payable-alerts] Exception sending email to ${user.email}:`, emailError);
        errors.push(`Exception for ${user.email}: ${emailError}`);
      }
    }

    console.log(`[check-payable-alerts] Completed. Emails sent: ${emailsSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        payablesFound: payables.length,
        emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[check-payable-alerts] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
