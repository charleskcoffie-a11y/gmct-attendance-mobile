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
      .select('admin_password')
      .eq('id', 'app_settings')
      .single()

    const configuredAdminCode = settings?.admin_password || 'admin123'
    
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

    // Use Supabase Admin API to update user password
    const { data: authUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      memberId,
      { password: defaultPassword }
    )

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Update member metadata to indicate password was reset
    await supabaseAdmin.auth.admin.updateUserById(
      memberId,
      { 
        user_metadata: { password_changed: false },
        email_confirm: true
      }
    )

    return new Response(
      JSON.stringify({
        success: true,
        member_id: member.id,
        member_name: member.name,
        email: member.email,
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
