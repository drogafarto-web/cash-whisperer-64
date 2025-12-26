import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  lis_login: string;
  lis_id: number | null;
  nome: string;
  email: string;
  role: string;
  unit_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to create users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: CreateUserRequest = await req.json();
    const { lis_login, lis_id, nome, email, role, unit_id } = body;

    console.log('Creating user from LIS:', { lis_login, lis_id, nome, email, role, unit_id });

    // Validate required fields
    if (!lis_login || !nome || !email || !role || !unit_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: lis_login, nome, email, role, unit_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'Email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if lis_login already linked
    const { data: existingLis } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('lis_login', lis_login.toUpperCase())
      .maybeSingle();

    if (existingLis) {
      return new Response(
        JSON.stringify({ error: 'LIS login already linked to another user' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create auth user with invite (no password, user will set on first login)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: nome,
        lis_login: lis_login,
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Auth user created:', userId);

    // 2. Update profile with LIS data (profile is created by trigger handle_new_user)
    // Wait a bit for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        lis_login: lis_login.toUpperCase(),
        lis_id: lis_id,
        name: nome,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail completely, profile might be created by trigger
    }

    // 3. Create user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Role assigned:', role);

    // 4. Create profile unit (primary)
    const { error: unitError } = await supabaseAdmin
      .from('profile_units')
      .insert({
        profile_id: userId,
        unit_id: unit_id,
        is_primary: true,
      });

    if (unitError) {
      console.error('Error creating profile unit:', unitError);
      // Non-critical, continue
    }

    console.log('Unit linked:', unit_id);

    // 5. Generate password reset link so user can set their password
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
    });

    if (resetError) {
      console.warn('Could not generate reset link:', resetError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: 'User created successfully',
        reset_link: resetData?.properties?.action_link || null,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
