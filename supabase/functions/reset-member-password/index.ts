import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const { memberId, adminCode } = await req.json()

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify admin password
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('attendance_admin_password, admin_password')
      .eq('id', 'app_settings')
      .single()

    const configuredAdminCode = settings?.attendance_admin_password || settings?.admin_password || 'admin123'
    
    if (adminCode.toLowerCase().trim() !== configuredAdminCode.toLowerCase().trim()) {
      return new Response(
        JSON.stringify({ error: 'Invalid admin password' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Get member info
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, name, email')
      .eq('id', memberId)
      .single()

    if (!member) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const defaultPassword = 'gmct2026'

    // Older accounts may have an Auth UUID different from members.id. Resolve
    // the account by the email that the member login flow uses.
    const { data: authUsers, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers()
    if (listUsersError) {
      return new Response(
        JSON.stringify({ error: listUsersError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const authUser = authUsers.users.find((user) =>
      user.id === memberId || user.email?.trim().toLowerCase() === member.email.trim().toLowerCase()
    )

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Member auth account not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const { data: updatedAuthUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: defaultPassword, user_metadata: { password_changed: false } }
    )

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        member_id: member.id,
        member_name: member.name,
        email: member.email,
        auth_user_id: updatedAuthUser.user.id,
        default_password: defaultPassword
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
