import imageCompression from 'browser-image-compression'
import { supabase, isSupabaseConfigured } from './supabase'
import { isDemoMode } from './dataMode'

/**
 * Kompresi file gambar menjadi format WebP dengan ukuran di bawah 200KB.
 * Menggunakan library `browser-image-compression`.
 *
 * @param {File} file - File gambar asli dari input
 * @param {Object} [customOptions] - Opsi tambahan
 * @returns {Promise<File>} File terkompresi berformat image/webp
 */
export async function compressImageToWebp(file, customOptions = {}) {
  const options = {
    maxSizeMB: 0.19, // Di bawah 200KB (~195 KB)
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
    ...customOptions,
  }

  try {
    const compressed = await imageCompression(file, options)
    // Pastikan ekstensi file diakhiri .webp
    const baseName = (file.name || 'image').replace(/\.[^/.]+$/, '')
    return new File([compressed], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } catch (error) {
    console.warn('[Storage] Gagal mengompresi gambar, menggunakan file asli:', error)
    return file
  }
}

/**
 * Upload gambar ke bucket Supabase Storage ('profile' atau 'stamp')
 * dengan kompresi WebP < 200KB terlebih dahulu.
 *
 * @param {'profile' | 'stamp'} bucket - Nama bucket Supabase Storage
 * @param {File} rawFile - File gambar dari input pengguna
 * @param {string} [userId] - User ID pemilik gambar
 * @returns {Promise<{ url: string, sizeKb: number, isWebp: boolean }>}
 */
export async function uploadImageToBucket(bucket, rawFile, userId = 'common') {
  if (!rawFile) {
    throw new Error('File gambar tidak ditemukan.')
  }
  if (!rawFile.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPEG, PNG, WebP, dll).')
  }

  // 1. Kompresi ke format WebP di bawah 200KB
  const webpFile = await compressImageToWebp(rawFile, {
    maxWidthOrHeight: bucket === 'profile' ? 800 : 1200,
    maxSizeMB: 0.19,
  })

  const sizeKb = Math.round(webpFile.size / 1024)

  // 2. Jika dalam Demo Mode atau Supabase belum dikonfigurasi, simpan data URL terkompresi
  if (isDemoMode.value || !isSupabaseConfigured || !supabase) {
    const dataUrl = await imageCompression.getDataUrlFromFile(webpFile)
    return {
      url: dataUrl,
      sizeKb,
      isWebp: webpFile.type === 'image/webp',
    }
  }

  // 3. Upload ke Supabase Storage (bukan base64 string)
  const cleanUserId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '')
  const randomId = Math.random().toString(36).slice(2, 9)
  const filePath = `${cleanUserId}/${Date.now()}-${randomId}.webp`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, webpFile, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    })

  if (error) {
    throw new Error(`Gagal upload ke bucket '${bucket}': ${error.message}`)
  }

  // 4. Ambil Public URL gambar
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  if (!urlData?.publicUrl) {
    throw new Error(`Gagal mendapatkan Public URL dari bucket '${bucket}'.`)
  }

  return {
    url: urlData.publicUrl,
    sizeKb,
    isWebp: true,
  }
}
