import { createClient } from './client'
import type { Member } from '../types'

const DEFAULT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
]

function deriveDisplayName(email: string): string {
  const prefix = email.split('@')[0] || ''
  // Capitalize first letter of each word split by dots/dashes/underscores
  return prefix
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function deriveInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return displayName.slice(0, 2).toUpperCase()
}

// Upsert a profile row — creates if missing, returns existing if present
export async function getOrCreateProfile(userId: string, email: string) {
  const supabase = createClient()

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing

  const displayName = deriveDisplayName(email)
  const initials = deriveInitials(displayName)
  const color = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      display_name: displayName,
      initials,
      color,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating profile:', error)
    return null
  }

  return data
}

// Load workspace members as Member[] for the assignee picker
export async function loadWorkspaceProfiles(projectId: string): Promise<Member[]> {
  const supabase = createClient()

  // Get all user_ids in this workspace
  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_memberships')
    .select('user_id')
    .eq('project_id', projectId)

  if (membershipError || !memberships?.length) {
    console.error('Error loading workspace memberships:', membershipError)
    return []
  }

  const userIds = memberships.map((m) => m.user_id)

  // Load their profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, display_name, initials, color, avatar_url')
    .in('user_id', userIds)

  if (profileError) {
    console.error('Error loading profiles:', profileError)
    return []
  }

  return (profiles || []).map((p) => ({
    id: p.user_id,
    name: p.display_name,
    initials: p.initials,
    color: p.color || 'bg-blue-500',
    avatar: p.avatar_url || undefined,
  }))
}

// Update profile fields
export async function updateProfile(
  userId: string,
  updates: { display_name?: string; initials?: string; color?: string; avatar_url?: string | null }
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating profile:', error)
    throw error
  }
}

// Upload avatar image and return public URL
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const { validateImageFile } = await import('../validate-file')
  validateImageFile(file)
  const supabase = createClient()

  const ext = file.name.split('.').pop() || 'png'
  const path = `avatars/${userId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('Project Logos')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError)
    throw uploadError
  }

  const { data } = supabase.storage
    .from('Project Logos')
    .getPublicUrl(path)

  return data.publicUrl
}

// Load the current user's profile
export async function loadCurrentProfile(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, initials, color, avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error loading profile:', error)
    return null
  }

  return data
}
