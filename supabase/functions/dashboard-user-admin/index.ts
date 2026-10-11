import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Metode tidak didukung.' }, 405)

  const authorization = request.headers.get('Authorization')
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!bearerToken) return jsonResponse({ error: 'Sesi admin diperlukan.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Konfigurasi server pemulihan akun belum lengkap.' }, 500)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(bearerToken)
  if (callerError || !callerData.user) return jsonResponse({ error: 'Sesi admin tidak valid.' }, 401)

  const { data: role, error: roleError } = await callerClient.rpc('dashboard_get_my_role')
  if (roleError) return jsonResponse({ error: `Gagal memverifikasi peran admin: ${roleError.message}` }, 403)
  if (!['admin', 'superadmin'].includes(role)) {
    return jsonResponse({ error: 'Aksi ini hanya dapat dilakukan admin.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Body permintaan tidak valid.' }, 400)
  }

  const userId = typeof body.user_id === 'string' ? body.user_id : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const hasBanAction = typeof body.banned === 'boolean'
  if (!userId || (!email && !password && !hasBanAction)) {
    return jsonResponse({ error: 'ID pengguna dan setidaknya satu perubahan wajib diisi.' }, 400)
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    return jsonResponse({ error: 'Format email baru tidak valid.' }, 400)
  }
  if (password && password.length < 8) {
    return jsonResponse({ error: 'Password baru minimal 8 karakter.' }, 400)
  }
  if (body.banned === true && userId === callerData.user.id) {
    return jsonResponse({ error: 'Admin tidak dapat menonaktifkan akunnya sendiri.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  if (body.banned === true) {
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', userId)
      .select('id')
      .maybeSingle()
    if (profileError) return jsonResponse({ error: `Gagal menonaktifkan profil: ${profileError.message}` }, 400)
    if (!profile) return jsonResponse({ error: 'Profil pengguna tidak ditemukan.' }, 404)
  }

  const authChanges: Record<string, unknown> = {}
  if (email) {
    authChanges.email = email
    authChanges.email_confirm = true
  }
  if (password) authChanges.password = password
  if (hasBanAction) authChanges.ban_duration = body.banned ? '876000h' : 'none'

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, authChanges)
  if (updateError) {
    if (body.banned === true) {
      const { error: rollbackError } = await adminClient
        .from('profiles')
        .update({ is_banned: false })
        .eq('id', userId)
      if (rollbackError) {
        return jsonResponse({
          error: `Auth gagal diperbarui (${updateError.message}) dan rollback status ban gagal (${rollbackError.message}).`,
        }, 500)
      }
    }
    return jsonResponse({ error: `Gagal memperbarui akun Auth: ${updateError.message}` }, 400)
  }

  if (body.banned === false) {
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({ is_banned: false })
      .eq('id', userId)
      .select('id')
      .maybeSingle()
    if (profileError) return jsonResponse({ error: `Auth sudah aktif, tetapi profil gagal diaktifkan: ${profileError.message}` }, 500)
    if (!profile) return jsonResponse({ error: 'Auth sudah aktif, tetapi profil pengguna tidak ditemukan.' }, 404)
  }

  const action = hasBanAction
    ? body.banned ? 'user.banned' : 'user.unbanned'
    : 'user.credentials_updated'
  const { error: auditError } = await adminClient.from('dashboard_audit_logs').insert({
    actor_id: callerData.user.id,
    action,
    target_type: 'user',
    target_id: userId,
    details: {
      email_changed: Boolean(email),
      password_changed: Boolean(password),
      banned: hasBanAction ? body.banned : null,
    },
  })
  if (auditError) return jsonResponse({ error: `Akun telah diperbarui, tetapi audit gagal disimpan: ${auditError.message}` }, 500)

  return jsonResponse({ ok: true })
})
