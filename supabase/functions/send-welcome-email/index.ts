import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  resetLink?: string; // If provided, use this link. Otherwise, generate a new one.
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, resetLink: providedResetLink }: WelcomeEmailRequest = await req.json();

    if (!email || !name) {
      console.error("Missing required fields:", { email, name });
      return new Response(
        JSON.stringify({ error: "Email e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending welcome email to:", email, "Name:", name);

    let resetLink = providedResetLink;

    // If no reset link provided, generate a new one
    if (!resetLink) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email.toLowerCase(),
      });

      if (resetError) {
        console.error("Error generating reset link:", resetError);
        return new Response(
          JSON.stringify({ error: "Falha ao gerar link de acesso" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resetLink = resetData?.properties?.action_link;
    }

    if (!resetLink) {
      console.error("No reset link available");
      return new Response(
        JSON.stringify({ error: "Link de acesso não disponível" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generated/Using reset link for:", email);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "LabClin <noreply@resend.dev>",
      to: [email],
      subject: "Bem-vindo ao LabClin - Configure sua senha",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bem-vindo ao LabClin</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 32px;">
                      <!-- Header -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">
                          🧪 LabClin
                        </h1>
                        <p style="margin: 8px 0 0; color: #71717a; font-size: 14px;">
                          Sistema de Gestão Laboratorial
                        </p>
                      </div>
                      
                      <!-- Greeting -->
                      <div style="margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 18px; color: #18181b;">
                          Olá, <strong>${name}</strong>! 👋
                        </p>
                      </div>
                      
                      <!-- Main content -->
                      <div style="margin-bottom: 32px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
                        <p style="margin: 0 0 16px;">
                          Você foi convidado para acessar o sistema LabClin.
                        </p>
                        <p style="margin: 0;">
                          Para começar, clique no botão abaixo para definir sua senha de acesso:
                        </p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <a href="${resetLink}" 
                           style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                          Definir minha senha
                        </a>
                      </div>
                      
                      <!-- Info -->
                      <div style="padding: 16px; background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 13px; color: #52525b;">
                          <strong>⏰ Importante:</strong> Este link é válido por 24 horas. 
                          Após definir sua senha, você poderá acessar o sistema normalmente.
                        </p>
                      </div>
                      
                      <!-- Alternative link -->
                      <div style="border-top: 1px solid #e4e4e7; padding-top: 20px;">
                        <p style="margin: 0 0 8px; font-size: 12px; color: #71717a;">
                          Se o botão não funcionar, copie e cole este link no navegador:
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #a1a1aa; word-break: break-all;">
                          ${resetLink}
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
                      <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                        Este email foi enviado automaticamente pelo sistema LabClin.<br>
                        Em caso de dúvidas, entre em contato com o administrador.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

Deno.serve(handler);
