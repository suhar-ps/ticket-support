// Edge Function: admin-create-user
//
// Dipanggil dari halaman Administrasi Pengguna (Supervisor) untuk
// membuat akun baru lengkap dengan password. Ini TIDAK BISA dilakukan
// lewat SQL biasa karena auth.users dikelola oleh GoTrue (hashing
// password, status verifikasi, dst) — harus lewat Admin API resmi
// (supabase.auth.admin.createUser), yang hanya boleh dipanggil dengan
// SERVICE ROLE KEY di sisi server. Karena itu fungsi ini berjalan
// sebagai Edge Function, bukan langsung dari browser.
//
// Alur keamanan:
// 1) Baca token JWT pemanggil dari header Authorization.
// 2) Verifikasi token itu & ambil user id-nya (pakai anon client).
// 3) Cek role user itu di tabel profiles lewat client SERVICE ROLE
//    (bypass RLS) — hanya lanjut jika role = 'supervisor'.
// 4) Baru buat user baru lewat Admin API.
//
// Deploy dengan Supabase CLI:
//   supabase functions deploy admin-create-user
//
// Env var SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY
// otomatis tersedia di setiap Edge Function — tidak perlu diatur manual.

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
      return jsonResponse({ error: 'Hanya Supervisor yang dapat menambah pengguna.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').trim()
    const password = body.password || ''
    const fullName = (body.full_name || '').trim()
    const role = ['user', 'support', 'supervisor'].includes(body.role) ? body.role : 'user'

    if (!email || !password || !fullName) {
      return jsonResponse({ error: 'Email, kata sandi, dan nama lengkap wajib diisi.' }, 400)
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Kata sandi minimal 6 karakter.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // akun dibuat admin, langsung dianggap terverifikasi
      user_metadata: { full_name: fullName, role },
    })

    if (createError) {
      return jsonResponse({ error: createError.message }, 400)
    }

    // Baris profiles dibuat otomatis oleh trigger on_auth_user_created
    // (membaca full_name/role dari user_metadata di atas) — tidak perlu
    // insert manual di sini.

    return jsonResponse({ user: { id: created.user.id, email: created.user.email } }, 200)
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Terjadi kesalahan tak terduga.' }, 500)
  }
})
