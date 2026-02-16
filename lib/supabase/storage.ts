import { createClient } from './client'

const BUCKET = 'Project Logos'

export async function uploadClientLogo(file: File, clientId: string): Promise<string> {
  const supabase = createClient()

  // Use client ID + extension for a clean, unique path
  const ext = file.name.split('.').pop() || 'png'
  const path = `${clientId}.${ext}`

  // Upsert so re-uploads replace the old file
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('Error uploading logo:', error)
    throw error
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

export async function deleteClientLogo(logoUrl: string): Promise<void> {
  const supabase = createClient()

  // Extract the path from the public URL
  const parts = logoUrl.split(`/storage/v1/object/public/${BUCKET}/`)
  if (parts.length < 2) return

  const path = parts[1]
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    console.error('Error deleting logo:', error)
  }
}
