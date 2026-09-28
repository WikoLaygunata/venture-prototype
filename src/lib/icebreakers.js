/**
 * Icebreaker Prompt Generator.
 *
 * Prompts are templated on the other person's profile so the opener feels
 * personal instead of generic. `{name}`, `{major}`, `{spot}` and `{interest}`
 * get substituted in `generateIcebreaker()`.
 */
const TEMPLATES = [
  'Halo {name}! Anak {major} ya? Aku penasaran, mata kuliah paling absurd yang pernah kamu ambil apa?',
  'Eh {name}, kalau disuruh milih: skripsi selesai bulan ini atau dapet magang impian?',
  'Hai {name}! Rekomendasi tempat nugas paling enak di kampus dong, aku bosen di {spot}.',
  '{name}, hot take: {major} itu overrated atau underrated? Aku mau denger alasannya.',
  'Halo {name}! Kalau harus jelasin {major} ke anak SD, kamu bilang apa?',
  'Hai {name}, playlist buat nugas kamu isinya apa? Aku butuh referensi baru.',
  '{name}, kalau ada kelas "cara jadi manusia berguna", kamu ngajarin topik apa?',
  'Halo {name}! Pertanyaan serius: nasi goreng kantin kampus, worth it atau nggak?',
  'Hai {name}! Satu hal random yang kamu bisa jelasin panjang banget tanpa persiapan apa?',
  '{name}, kamu tipe yang duduk depan atau belakang kelas? Aku mau nebak kepribadianmu.',
  'Halo {name}! Kalau punya 2 jam kosong di kampus, kamu ngapain?',
  'Hai {name}, {interest} ya? Ceritain gimana awalnya kamu suka itu.',
]

const FALLBACK = {
  name: 'kamu',
  major: 'jurusanmu',
  spot: 'perpus',
  interest: 'hobi kamu',
}

/**
 * Builds a personalised opener for a profile.
 * @param {object} profile   profile row (full_name, major, interests[])
 * @param {string|null} previous  last prompt, so we avoid repeating it
 * @returns {string}
 */
export function generateIcebreaker(profile = {}, previous = null) {
  const vars = {
    name: (profile.full_name || FALLBACK.name).split(' ')[0],
    major: profile.major || FALLBACK.major,
    spot: FALLBACK.spot,
    interest: profile.interests?.[0] || FALLBACK.interest,
  }

  const pool = TEMPLATES.filter((t) => render(t, vars) !== previous)
  const template = pool[Math.floor(Math.random() * pool.length)] ?? TEMPLATES[0]
  return render(template, vars)
}

function render(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? FALLBACK[key] ?? '')
}
