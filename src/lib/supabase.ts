import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const configured = Boolean(url && key)

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export async function labelUrl(path: string | null | undefined, width = 400): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('labels').createSignedUrl(path, 60 * 60, {
    transform: { width, resize: 'contain' },
  })
  return error ? null : data.signedUrl
}

/** Upload a label photo, returns storage path. Compresses to ~1200px JPEG first. */
export async function uploadLabel(file: File, prefix: string): Promise<string> {
  const blob = await compressImage(file, 1200, 0.82)
  const path = `${prefix}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('labels').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

async function compressImage(file: File, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality))
}
