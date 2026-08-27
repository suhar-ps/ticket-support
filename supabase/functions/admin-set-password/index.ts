// Edge Function: admin-set-password
//
// Dipanggil dari halaman Administrasi Pengguna (Supervisor) untuk
// mengatur ulang password seorang pengguna secara langsung. Sama seperti
// pembuatan akun (admin-create-user), ini WAJIB lewat Admin API (bukan
// SQL biasa) karena hashing & validasi password ditangani oleh GoTrue,
// dan Admin API hanya boleh dipanggil dengan SERVICE ROLE KEY di sisi
// server — karena itu ini berjalan sebagai Edge Function.
//
// Alur keamanan sama seperti admin-create-user: verifikasi token
// pemanggil, cek role-nya di tabel profiles lewat client service role
// (bypass RLS), baru lanjut kalau memang 'supervisor'.
//
// Deploy dengan Supabase CLI:
//   supabase functions deploy admin-set-password

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Tidak ada token otorisasi.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Client dengan identitas SI PEMANGGIL, untuk memverifikasi siapa dia.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData?.user) {
      return jsonResponse({ error: 'Sesi tidak valid, silakan login ulang.' }, 401)
    }

    // Client SERVICE ROLE, untuk operasi admin (bypass RLS).
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .single()

    if (profileError || callerProfile?.role !== 'supervisor') {
      return jsonResponse(
        { error: 'Hanya Supervisor yang dapat mengatur ulang kata sandi pengguna.' },
        403
      )
    }

    const body = await req.json().catch(() => ({}))
    const targetUserId = body.target_user_id
    const newPassword = body.new_password || ''

    if (!targetUserId) {
      return jsonResponse({ error: 'ID pengguna target wajib diisi.' }, 400)
    }
    if (newPassword.length < 6) {
      return jsonResponse({ error: 'Kata sandi minimal 6 karakter.' }, 400)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400)
    }

    return jsonResponse({ success: true }, 200)
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Terjadi kesalahan tak terduga.' }, 500)
  }
})
