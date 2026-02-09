import { supabase } from './supabase'

export interface ImageRecord {
  id: string
  category: string
  storage_path: string
  url: string
  created_at: string
}

// ====== FETCH ======

export async function fetchImagesByCategory(
  category: string,
): Promise<ImageRecord[]> {
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ImageRecord[]
}

// ====== COMPRESS ======

const MAX_SIZE = 1200
const QUALITY = 0.8

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round(height * (MAX_SIZE / width))
          width = MAX_SIZE
        } else {
          width = Math.round(width * (MAX_SIZE / height))
          height = MAX_SIZE
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/webp',
        QUALITY,
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// ====== UPLOAD ======

export async function uploadImage(
  category: string,
  file: File,
): Promise<ImageRecord> {
  const blob = await compressImage(file)
  const filename = `${category}/${crypto.randomUUID()}.webp`

  const { error: storageError } = await supabase.storage
    .from('tablero-images')
    .upload(filename, blob, { contentType: 'image/webp' })

  if (storageError) throw storageError

  const { data: urlData } = supabase.storage
    .from('tablero-images')
    .getPublicUrl(filename)

  const { data, error: dbError } = await supabase
    .from('images')
    .insert({
      category,
      storage_path: filename,
      url: urlData.publicUrl,
    })
    .select()
    .single()

  if (dbError) throw dbError
  return data as ImageRecord
}

// ====== DELETE ======

export async function deleteImage(record: ImageRecord): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('tablero-images')
    .remove([record.storage_path])

  if (storageError) throw storageError

  const { error: dbError } = await supabase
    .from('images')
    .delete()
    .eq('id', record.id)

  if (dbError) throw dbError
}
