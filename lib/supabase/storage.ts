import { createClient } from './client'
import { validateImageFile } from '../validate-file'

const BUCKET = 'Project Logos'
const TASK_IMAGES_BUCKET = 'task-images'

export async function uploadClientLogo(file: File, clientId: string): Promise<string> {
  validateImageFile(file)
  const supabase = createClient()

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

export async function uploadWorkspaceLogo(file: File, projectId: string): Promise<string> {
  validateImageFile(file)
  const supabase = createClient()

  const ext = file.name.split('.').pop() || 'png'
  const path = `workspaces/${projectId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('Error uploading workspace logo:', error)
    throw error
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

export async function deleteWorkspaceLogo(logoUrl: string): Promise<void> {
  const supabase = createClient()

  const marker = `/storage/v1/object/public/`
  const markerIdx = logoUrl.indexOf(marker)
  if (markerIdx === -1) return

  const afterMarker = logoUrl.slice(markerIdx + marker.length)
  const decodedAfter = decodeURIComponent(afterMarker)

  let path: string | null = null
  if (decodedAfter.startsWith(BUCKET + '/')) {
    path = decodedAfter.slice(BUCKET.length + 1)
  }

  if (!path) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    console.error('Error deleting workspace logo:', error)
  }
}

export async function uploadTaskImage(file: File, taskId: string): Promise<string> {
  validateImageFile(file)
  const supabase = createClient()

  const ext = file.name.split('.').pop() || 'png'
  const path = `${taskId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(TASK_IMAGES_BUCKET)
    .upload(path, file)

  if (error) {
    console.error('Error uploading task image:', error)
    throw error
  }

  const { data } = supabase.storage
    .from(TASK_IMAGES_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

export async function deleteTaskImage(imageUrl: string): Promise<void> {
  const supabase = createClient()

  const marker = `/storage/v1/object/public/`
  const markerIdx = imageUrl.indexOf(marker)
  if (markerIdx === -1) return

  const afterMarker = imageUrl.slice(markerIdx + marker.length)
  const decodedAfter = decodeURIComponent(afterMarker)

  let path: string | null = null
  if (decodedAfter.startsWith(TASK_IMAGES_BUCKET + '/')) {
    path = decodedAfter.slice(TASK_IMAGES_BUCKET.length + 1)
  }

  if (!path) return

  const { error } = await supabase.storage
    .from(TASK_IMAGES_BUCKET)
    .remove([path])

  if (error) {
    console.error('Error deleting task image:', error)
  }
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
