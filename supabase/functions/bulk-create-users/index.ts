import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserToCreate {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string | null;
  unitNames: string[];
  primaryUnitName: string;
  role: string;
  password: string;
  isCnpj: boolean;
  hasNoCpf: boolean;
}

interface RequestBody {
  users: UserToCreate[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body: RequestBody = await req.json();
    const { users } = body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de usuários vazia ou inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const userData of users) {
      try {
        console.log(`Processing user: ${userData.email}`);

        // Validate required fields
        if (!userData.email || !userData.name) {
          results.push({ email: userData.email || "unknown", success: false, error: "Email e nome são obrigatórios" });
          continue;
        }

        // Check if user already exists by email
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .eq("email", userData.email.toLowerCase())
          .maybeSingle();

        // Check if user exists by CPF
        let existingByCpf = null;
        if (userData.cpf && !userData.hasNoCpf) {
          const cleanCpf = userData.cpf.replace(/\D/g, "");
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, email")
            .eq("cpf", cleanCpf)
            .maybeSingle();
          existingByCpf = data;
        }

        let userId: string;

        if (existingProfile) {
          // Update existing user
          userId = existingProfile.id;
          console.log(`Updating existing user by email: ${userId}`);
        } else if (existingByCpf) {
          // Update existing user found by CPF
          userId = existingByCpf.id;
          console.log(`Updating existing user by CPF: ${userId}`);
        } else {
          // Create new user
          console.log(`Creating new user: ${userData.email}`);
          
          const password = userData.password || "123456";
          
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email.toLowerCase(),
            password: password,
            email_confirm: true,
            user_metadata: {
              name: userData.name,
            },
          });

          if (authError) {
            console.error(`Auth error for ${userData.email}:`, authError);
            results.push({ email: userData.email, success: false, error: authError.message });
            continue;
          }

          userId = authData.user.id;

          // Send welcome email for new users
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
            
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                email: userData.email.toLowerCase(),
                name: userData.name,
              }),
            });

            if (!emailResponse.ok) {
              console.warn(`Failed to send welcome email to ${userData.email}:`, await emailResponse.text());
            } else {
              console.log(`Welcome email sent to: ${userData.email}`);
            }
          } catch (emailError) {
            console.warn(`Error sending welcome email to ${userData.email}:`, emailError);
          }
        }

        // Prepare CPF for storage
        const cleanCpf = userData.cpf ? userData.cpf.replace(/\D/g, "") : null;

        // Update profile with additional data
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            name: userData.name,
            cpf: cleanCpf,
            telefone: userData.phone || null,
            data_nascimento: userData.birthDate || null,
            must_change_password: true,
          })
          .eq("id", userId);

        if (profileError) {
          console.error(`Profile update error for ${userData.email}:`, profileError);
        }

        // Get units by name
        const { data: unitsData } = await supabaseAdmin
          .from("units")
          .select("id, name");

        const unitMap = new Map((unitsData || []).map(u => [u.name.toLowerCase(), u.id]));

        // Handle role
        // First delete existing role
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        // Insert new role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: userId,
            role: userData.role,
          });

        if (roleError) {
          console.error(`Role error for ${userData.email}:`, roleError);
        }

        // Handle unit assignments
        // First delete existing unit assignments
        await supabaseAdmin
          .from("profile_units")
          .delete()
          .eq("profile_id", userId);

        // Insert new unit assignments
        const unitAssignments = [];
        let primaryUnitId: string | null = null;

        for (const unitName of userData.unitNames) {
          const unitId = unitMap.get(unitName.toLowerCase());
          if (unitId) {
            const isPrimary = unitName === userData.primaryUnitName;
            if (isPrimary) primaryUnitId = unitId;
            
            unitAssignments.push({
              profile_id: userId,
              unit_id: unitId,
              is_primary: isPrimary,
            });
          }
        }

        if (unitAssignments.length > 0) {
          const { error: unitsError } = await supabaseAdmin
            .from("profile_units")
            .insert(unitAssignments);

          if (unitsError) {
            console.error(`Units error for ${userData.email}:`, unitsError);
          }

          // Also update legacy unit_id field
          if (primaryUnitId) {
            await supabaseAdmin
              .from("profiles")
              .update({ unit_id: primaryUnitId })
              .eq("id", userId);
          }
        }

        results.push({ email: userData.email, success: true });
        console.log(`Successfully processed: ${userData.email}`);

      } catch (userError: any) {
        console.error(`Error processing user ${userData.email}:`, userError);
        results.push({ email: userData.email, success: false, error: userError.message || "Erro desconhecido" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`Import complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: users.length,
          success: successCount,
          failed: failedCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Bulk create users error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
