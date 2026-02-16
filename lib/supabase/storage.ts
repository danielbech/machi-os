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

  // Extract the file path from the public URL
  // URL may contain URL-encoded bucket name (e.g. "Project%20Logos")
  const encodedBucket = encodeURIComponent(BUCKET).replace(/%20/g, '%20')
  const marker = `/storage/v1/object/public/`
  const markerIdx = logoUrl.indexOf(marker)
  if (markerIdx === -1) return

  const afterMarker = logoUrl.slice(markerIdx + marker.length)
  // afterMarker is "Project%20Logos/filename.png" or "Project Logos/filename.png"
  // Try both encoded and non-encoded forms
  let path: string | null = null
  const decodedAfter = decodeURIComponent(afterMarker)

  if (decodedAfter.startsWith(BUCKET + '/')) {
    path = decodedAfter.slice(BUCKET.length + 1)
  }

  if (!path) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    console.error('Error deleting logo:', error)
  }
}
