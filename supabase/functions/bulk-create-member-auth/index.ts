import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const { adminCode } = await req.json()

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

    // Get all members
    const { data: members } = await supabaseAdmin
      .from('members')
      .select('id, name, email')

    if (!members) {
      return new Response(
        JSON.stringify({ error: 'No members found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const defaultPassword = 'gmct2026'
    const results = {
      created: [],
      skipped: [],
      errors: []
    }

    // Get all existing auth users once (not in loop)
    const { data: existingUserData } = await supabaseAdmin.auth.admin.listUsers()
    const existingEmails = new Set(existingUserData.users.map(u => u.email))

    // Process each member
    for (const member of members) {
      try {
        // Check if auth user already exists
        const userExists = existingEmails.has(member.email)

        if (userExists) {
          results.skipped.push({ name: member.name, email: member.email, reason: 'Already has auth account' })
          continue
        }

        // Create auth user using Admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            password_changed: false,
            name: member.name
          }
        })

        if (createError) {
          results.errors.push({ name: member.name, email: member.email, error: createError.message })
        } else {
          results.created.push({ name: member.name, email: member.email, id: newUser.user.id })
        }

      } catch (error) {
        results.errors.push({ name: member.name, email: member.email, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: members.length,
          created: results.created.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        },
        results: results,
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
