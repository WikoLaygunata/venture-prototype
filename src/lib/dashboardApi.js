import {
  dashboardSupabase,
  isDashboardSupabaseEnabled,
  isDashboardSupabaseRequested,
} from './supabase'
import { dashboardRole } from '@/stores/dashboardAuth'
import { demoDb, demoId, fakeDelay, persistDemoDb, setDemoPassword } from './mockData'

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at)

function profileFor(id) {
  return demoDb.profiles.find((profile) => profile.id === id) ?? null
}

function addDemoAuditEntry(action, targetType, targetId, details) {
  demoDb.dashboard_audit_logs.push({
    id: demoId('audit'),
    actor_id: 'demo-admin',
    action,
    target_type: targetType,
    target_id: String(targetId),
    details,
    created_at: new Date().toISOString(),
  })
}

function publicAdminProfile(profile) {
  if (!profile) return null
  return {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    faculty: profile.faculty,
    major: profile.major,
    batch: profile.batch,
    color_code: profile.color_code,
    is_discoverable: profile.is_discoverable,
    created_at: profile.created_at,
  }
}

function requireDashboardClient() {
  if (!dashboardSupabase) throw new Error('Koneksi Supabase dashboard tidak tersedia.')
  return dashboardSupabase
}

function isDashboardDemoMode() {
  if (isDashboardSupabaseRequested && !isDashboardSupabaseEnabled) {
    throw new Error('Dashboard Supabase diminta, tetapi VITE_SUPABASE_URL atau anon key belum diisi.')
  }
  return !isDashboardSupabaseEnabled
}

function throwQueryError(error, action) {
  if (error) throw new Error(`${action}: ${error.message}`)
}

function normalizedSearch(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .slice(0, 80)
}

export async function fetchDashboardSummary() {
  if (isDashboardDemoMode()) {
    await fakeDelay(180)
    const now = Date.now()
    const recentUsers = demoDb.profiles.filter(
      (profile) => now - new Date(profile.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
    ).length
    return {
      users: demoDb.profiles.length,
      newUsers: recentUsers,
      unclaimedTokens: demoDb.nfc_tokens.filter((token) => token.status === 'unclaimed').length,
      activeStamps: demoDb.location_stamps.filter(
        (stamp) => new Date(stamp.created_at).getTime() > now - 24 * 60 * 60 * 1000,
      ).length,
      pendingReports: demoDb.reports.filter((report) => report.status === 'pending').length,
      recentReports: [...demoDb.reports].sort(byNewest).slice(0, 5).map(decorateDemoReport),
      recentUsersList: [...demoDb.profiles]
        .sort(byNewest)
        .slice(0, 5)
        .map(publicAdminProfile),
    }
  }

  const client = requireDashboardClient()
  const [users, newUsers, tokens, stamps, reports, recentReports, recentUsersList] =
    await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }),
      client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      client.rpc('dashboard_count_unclaimed_tokens'),
      client
        .from('location_stamps')
        .select('id', { count: 'exact', head: true })
        .gt('expires_at', new Date().toISOString()),
      client.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      client
        .from('reports')
        .select('id,report_type,reason,status,created_at,reported:profiles!reports_reported_id_fkey(id,username,full_name)')
        .order('created_at', { ascending: false })
        .limit(5),
      client
        .from('profiles')
        .select('id,username,full_name,avatar_url,created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  for (const [result, action] of [
    [users, 'Gagal memuat jumlah pengguna'],
    [newUsers, 'Gagal memuat pengguna baru'],
    [tokens, 'Gagal memuat jumlah token'],
    [stamps, 'Gagal memuat jumlah stamp'],
    [reports, 'Gagal memuat jumlah laporan'],
    [recentReports, 'Gagal memuat laporan terbaru'],
    [recentUsersList, 'Gagal memuat pengguna terbaru'],
  ]) {
    throwQueryError(result.error, action)
  }

  return {
    users: users.count ?? 0,
    newUsers: newUsers.count ?? 0,
    unclaimedTokens: Number(tokens.data) || 0,
    activeStamps: stamps.count ?? 0,
    pendingReports: reports.count ?? 0,
    recentReports: recentReports.data ?? [],
    recentUsersList: recentUsersList.data ?? [],
  }
}

export async function fetchDashboardUsers({ query = '', page = 1, pageSize = 10 } = {}) {
  const safeQuery = normalizedSearch(query)
  if (isDashboardDemoMode()) {
    await fakeDelay(150)
    const filtered = demoDb.profiles
      .filter((profile) => {
        const haystack = `${profile.full_name} ${profile.username} ${profile.faculty}`.toLowerCase()
        return haystack.includes(safeQuery.toLowerCase())
      })
      .sort(byNewest)
    const start = (page - 1) * pageSize
    return {
      rows: filtered.slice(start, start + pageSize).map(publicAdminProfile),
      total: filtered.length,
    }
  }

  const client = requireDashboardClient()
  let request = client
    .from('profiles')
    .select('id,username,full_name,avatar_url,faculty,major,batch,color_code,is_discoverable,created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })

  if (safeQuery) {
    request = request.or(
      `username.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%,faculty.ilike.%${safeQuery}%`,
    )
  }
  const start = (page - 1) * pageSize
  const { data, count, error } = await request.range(start, start + pageSize - 1)
  throwQueryError(error, 'Gagal memuat pengguna')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function fetchDashboardUser(userId) {
  if (!userId) throw new Error('ID pengguna tidak valid.')
  if (isDashboardDemoMode()) {
    await fakeDelay()
    const profile = profileFor(userId)
    if (!profile) return null
    return {
      ...publicAdminProfile(profile),
      bio: profile.bio,
      email: profile.admin_email ?? `${profile.username}@example.test`,
      instagram: profile.instagram ?? '',
      linkedin: profile.linkedin ?? '',
      spotify: profile.spotify ?? '',
      whatsapp: profile.whatsapp ?? '',
      line: profile.line ?? '',
      is_banned: Boolean(profile.is_banned),
      stamp_history_public: profile.stamp_history_public,
      mutual_count: demoDb.mutuals.filter(
        (mutual) => mutual.user_a_id === userId || mutual.user_b_id === userId,
      ).length,
      stamp_count: demoDb.location_stamps.filter((stamp) => stamp.user_id === userId).length,
      report_count: demoDb.reports.filter((report) => report.reported_id === userId).length,
    }
  }

  const client = requireDashboardClient()
  const canReadContacts = ['admin', 'superadmin'].includes(dashboardRole.value)
  const [{ data: profile, error }, activity, contacts] = await Promise.all([
    client
      .from('profiles')
      .select('id,username,full_name,avatar_url,faculty,major,batch,bio,color_code,is_discoverable,stamp_history_public,created_at')
      .eq('id', userId)
      .maybeSingle(),
    client.rpc('dashboard_user_activity_counts', { p_user_id: userId }),
    canReadContacts
      ? client.rpc('dashboard_user_contact_details', { p_user_id: userId })
      : Promise.resolve({ data: null, error: null }),
  ])
  throwQueryError(error, 'Gagal memuat detail pengguna')
  throwQueryError(activity.error, 'Gagal memuat ringkasan aktivitas')
  throwQueryError(contacts.error, 'Gagal memuat data kontak pengguna')
  if (!profile) return null
  const contactDetails = contacts.data
  if (canReadContacts && !contactDetails) return null
  const counts = Array.isArray(activity.data) ? activity.data[0] : activity.data
  return {
    ...profile,
    ...(contactDetails ?? {}),
    mutual_count: Number(counts?.mutual_count) || 0,
    stamp_count: Number(counts?.stamp_count) || 0,
    report_count: Number(counts?.report_count) || 0,
  }
}

export async function administerDashboardUser(userId, changes) {
  if (!userId) throw new Error('ID pengguna tidak valid.')
  if (changes.email && (!/\S+@\S+\.\S+/.test(String(changes.email)) || String(changes.email).length > 254)) {
    throw new Error('Format email baru tidak valid.')
  }
  if (changes.password && String(changes.password).length < 8) {
    throw new Error('Password baru minimal 8 karakter.')
  }
  if (changes.banned !== undefined && typeof changes.banned !== 'boolean') {
    throw new Error('Status ban tidak valid.')
  }
  if (!changes.email && !changes.password && typeof changes.banned !== 'boolean') {
    throw new Error('Isi minimal satu perubahan akun.')
  }
  if (isDashboardDemoMode()) {
    const profile = profileFor(userId)
    if (!profile) throw new Error('Pengguna tidak ditemukan.')
    if (changes.email) profile.admin_email = String(changes.email).trim().toLowerCase()
    if (changes.password) setDemoPassword(changes.password)
    if (typeof changes.banned === 'boolean') profile.is_banned = changes.banned
    const action = typeof changes.banned === 'boolean' ? (changes.banned ? 'user.banned' : 'user.unbanned') : 'user.credentials_updated'
    addDemoAuditEntry(action, 'user', userId, {
      email_changed: Boolean(changes.email),
      password_changed: Boolean(changes.password),
      banned: changes.banned,
    })
    persistDemoDb()
    await fakeDelay(120)
    return fetchDashboardUser(userId)
  }

  const { data, error } = await requireDashboardClient().functions.invoke('dashboard-user-admin', {
    body: { user_id: userId, ...changes },
  })
  throwQueryError(error, 'Gagal mengelola akun pengguna')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchDashboardTokens({ query = '', status = 'all', page = 1, pageSize = 10 } = {}) {
  const safeQuery = normalizedSearch(query).toLowerCase()
  if (isDashboardDemoMode()) {
    await fakeDelay(150)
    const rows = demoDb.nfc_tokens
      .map((token) => ({ ...token, owner: publicAdminProfile(profileFor(token.user_id)) }))
      .filter((token) => status === 'all' || token.status === status)
      .filter((token) => {
        const haystack = `${token.token} ${token.batch_label ?? ''} ${token.owner?.username ?? ''}`
        return haystack.toLowerCase().includes(safeQuery)
      })
      .sort(byNewest)
    const start = (page - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize), total: rows.length }
  }

  const client = requireDashboardClient()
  let request = client
    .from('nfc_tokens')
    .select(
      'id,token,status,user_id,batch_label,created_at,claimed_at,owner:profiles!nfc_tokens_user_id_fkey(id,username,full_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
  if (status !== 'all') request = request.eq('status', status)
  if (safeQuery) request = request.ilike('token', `%${safeQuery}%`)
  const start = (page - 1) * pageSize
  const { data, count, error } = await request.range(start, start + pageSize - 1)
  throwQueryError(error, 'Gagal memuat token NFC')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function createDashboardToken(batchLabel = '') {
  return createDashboardTokens(batchLabel, 1).then((tokens) => tokens[0])
}

export async function createDashboardTokens(batchLabel = '', count = 1) {
  const safeCount = Number(count)
  if (!Number.isInteger(safeCount) || safeCount < 1 || safeCount > 20) {
    throw new Error('Jumlah token harus antara 1 dan 20.')
  }
  const label = String(batchLabel).trim().slice(0, 80)
  if (isDashboardDemoMode()) {
    await fakeDelay(180)
    const rows = []
    for (let index = 0; index < safeCount; index += 1) {
      let token
      do {
        token = `KNL-${randomHex(6)}`
      } while (
        demoDb.nfc_tokens.some((row) => row.token === token) ||
        rows.some((row) => row.token === token)
      )
      const row = {
        id: demoId('t'),
        token,
        status: 'unclaimed',
        user_id: null,
        batch_label: label,
        created_at: new Date().toISOString(),
        claimed_at: null,
      }
      demoDb.nfc_tokens.push(row)
      addDemoAuditEntry('nfc_token.created', 'nfc_token', row.id, { batch_label: label })
      rows.push({ ...row })
    }
    persistDemoDb()
    return rows
  }

  const { data, error } = await requireDashboardClient().rpc('dashboard_create_nfc_token', {
    p_batch_label: label || null,
    p_count: safeCount,
  })
  throwQueryError(error, 'Gagal membuat token NFC')
  if (!Array.isArray(data) || data.length !== safeCount) {
    throw new Error('Pembuatan batch token tidak mengembalikan jumlah token yang diharapkan.')
  }
  return data
}

export async function fetchDashboardStamps({ page = 1, pageSize = 10 } = {}) {
  if (isDashboardDemoMode()) {
    await fakeDelay(150)
    const rows = [...demoDb.location_stamps]
      .sort(byNewest)
      .map((stamp) => ({ ...stamp, author: publicAdminProfile(profileFor(stamp.user_id)) }))
    const start = (page - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize), total: rows.length }
  }

  const client = requireDashboardClient()
  const start = (page - 1) * pageSize
  const { data, count, error } = await client
    .from('location_stamps')
    .select(
      'id,user_id,message,created_at,expires_at,lat,lng,location_label,author:profiles!location_stamps_user_id_fkey(id,username,full_name,avatar_url,color_code)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(start, start + pageSize - 1)
  throwQueryError(error, 'Gagal memuat Location Stamps')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function fetchDashboardStampThread(stampId) {
  if (!stampId) throw new Error('ID stamp tidak valid.')
  if (isDashboardDemoMode()) {
    await fakeDelay(150)
    const stamp = demoDb.location_stamps.find((item) => item.id === stampId)
    if (!stamp) return null
    return {
      ...stamp,
      author: publicAdminProfile(profileFor(stamp.user_id)),
      replies: demoDb.stamp_replies
        .filter((reply) => reply.stamp_id === stampId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map((reply) => ({
          ...reply,
          author: publicAdminProfile(profileFor(reply.user_id)),
        })),
    }
  }

  const { data, error } = await requireDashboardClient().rpc(
    'dashboard_get_stamp_thread',
    { p_stamp_id: stampId },
  )
  throwQueryError(error, 'Gagal memuat detail thread stamp')
  return data
}

function decorateDemoReport(report) {
  return {
    ...report,
    report_type: report.report_type ?? 'user',
    status: report.status ?? 'pending',
    reporter: publicAdminProfile(profileFor(report.reporter_id)),
    reported: publicAdminProfile(profileFor(report.reported_id)),
  }
}

export async function fetchDashboardReports({ status = 'all', page = 1, pageSize = 10 } = {}) {
  if (isDashboardDemoMode()) {
    await fakeDelay(150)
    const rows = [...demoDb.reports]
      .filter((report) => status === 'all' || report.status === status)
      .sort(byNewest)
      .map(decorateDemoReport)
    const start = (page - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize), total: rows.length }
  }

  const client = requireDashboardClient()
  let request = client
    .from('reports')
    .select(
      'id,report_type,reason,status,created_at,reviewed_at,reporter:profiles!reports_reporter_id_fkey(id,username,full_name),reported:profiles!reports_reported_id_fkey(id,username,full_name),stamp:location_stamps!reports_target_stamp_id_fkey(id,message)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
  if (status !== 'all') request = request.eq('status', status)
  const start = (page - 1) * pageSize
  const { data, count, error } = await request.range(start, start + pageSize - 1)
  throwQueryError(error, 'Gagal memuat laporan')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function updateDashboardReportStatus(reportId, status) {
  if (!reportId) throw new Error('ID laporan tidak valid.')
  if (!['resolved', 'dismissed'].includes(status)) {
    throw new Error('Status penanganan laporan tidak valid.')
  }
  if (isDashboardDemoMode()) {
    const report = demoDb.reports.find((row) => row.id === reportId)
    if (!report) throw new Error('Laporan tidak ditemukan.')
    report.status = status
    report.reviewed_at = new Date().toISOString()
    addDemoAuditEntry(
      'report.status_changed',
      'report',
      reportId,
      { to: status },
    )
    persistDemoDb()
    await fakeDelay(150)
    return { ...report }
  }

  const { data, error } = await requireDashboardClient().rpc('dashboard_set_report_status', {
    p_report_id: reportId,
    p_status: status,
  })
  throwQueryError(error, 'Gagal memperbarui status laporan')
  return data
}

function randomHex(byteCount) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Browser ini tidak mendukung pembuatan token yang aman.')
  }
  const bytes = new Uint8Array(byteCount)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}
