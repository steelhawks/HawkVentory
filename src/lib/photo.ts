import { supabase } from './supabase'

const BUCKET = 'item-photos'
const MAX_DIM = 1600
const QUALITY = 0.85

/**
 * Downscale a phone-sized image to ≤MAX_DIM on the longest edge and re-encode as JPEG.
 * Phones routinely shoot 4–8 MB; this gets us under 500 KB without visible quality loss.
 */
export async function resizeImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not read image'))
      i.src = url
    })
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unsupported')
    ctx.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), 'image/jpeg', QUALITY),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadItemPhoto(file: File): Promise<string> {
  const blob = await resizeImage(file)
  const id = crypto.randomUUID()
  const path = `${id}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort cleanup; ignore failures (file may be missing). */
export async function deleteItemPhoto(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return
  const marker = `/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return
  const path = publicUrl.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}
