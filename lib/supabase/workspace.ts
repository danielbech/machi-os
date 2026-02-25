import { createClient } from './client'
import type { Project, PendingInvite } from '../types'

export interface WorkspaceMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  email?: string
  display_name?: string
  avatar_url?: string | null
  color?: string
}

// Get all workspaces the current user is a member of
export async function getUserWorkspaces(): Promise<Project[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select(`
      role,
      projects:project_id (
        id,
        name,
        color,
        logo_url,
        week_mode,
        transition_day,
        transition_hour
      )
    `)
    .eq('user_id', user.id)
    .order('created_at')

  if (error) {
    console.error('Error fetching workspaces:', error)
    return []
  }

  return (data || [])
    .filter((d: any) => d.projects)
    .map((d: any) => ({
      id: d.projects.id,
      name: d.projects.name,
      color: d.projects.color,
      logo_url: d.projects.logo_url || undefined,
      role: d.role,
      week_mode: d.projects.week_mode || '5-day',
      transition_day: d.projects.transition_day ?? 5,
      transition_hour: d.projects.transition_hour ?? 17,
    }))
}

// Get all members of a workspace
export async function getWorkspaceMembers(projectId: string): Promise<WorkspaceMember[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select(`
      id,
      user_id,
      role,
      created_at
    `)
    .eq('project_id', projectId)
    .order('created_at')

  if (error) {
    console.error('Error fetching workspace members:', error)
    throw error
  }

  return data || []
}

// Get pending invites for a project
export async function getPendingInvites(projectId: string): Promise<PendingInvite[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pending_invites')
    .select('id, project_id, email, role, invited_by, created_at')
    .eq('project_id', projectId)
    .order('created_at')

  if (error) {
    console.error('Error fetching pending invites:', error)
    return []
  }

  return data || []
}

// Get pending invites for the current user (invites addressed to their email)
export interface MyPendingInvite {
  id: string
  project_id: string
  role: 'admin' | 'member'
  created_at: string
  workspace_name: string
  workspace_color: string
}

export async function getMyPendingInvites(): Promise<MyPendingInvite[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pending_invites')
    .select('id, project_id, role, created_at, projects:project_id (name, color)')
    .order('created_at')

  if (error) {
    console.error('Error fetching my pending invites:', error)
    return []
  }

  return (data || [])
    .filter((d: any) => d.projects)
    .map((d: any) => ({
      id: d.id,
      project_id: d.project_id,
      role: d.role,
      created_at: d.created_at,
      workspace_name: d.projects.name,
      workspace_color: d.projects.color,
    }))
}

// Accept a pending invite — insert membership then delete the invite
export async function acceptInvite(inviteId: string, projectId: string, role: string): Promise<void> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error: membershipError } = await supabase
    .from('workspace_memberships')
    .insert({ project_id: projectId, user_id: user.id, role })

  if (membershipError) {
    console.error('Error accepting invite:', membershipError)
    throw membershipError
  }

  const { error: deleteError } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId)

  if (deleteError) {
    console.error('Error deleting invite after accept:', deleteError)
  }
}

// Decline a pending invite — just delete it
export async function declineInvite(inviteId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    console.error('Error declining invite:', error)
    throw error
  }
}

// Cancel a pending invite
export async function cancelInvite(inviteId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    console.error('Error canceling invite:', error)
    throw error
  }
}

// Remove a user from the workspace
export async function removeUserFromWorkspace(membershipId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('id', membershipId)

  if (error) {
    console.error('Error removing user:', error)
    throw error
  }
}

// Update a user's role in the workspace
export async function updateMemberRole(
  membershipId: string,
  role: 'owner' | 'admin' | 'member'
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('workspace_memberships')
    .update({ role })
    .eq('id', membershipId)

  if (error) {
    console.error('Error updating member role:', error)
    throw error
  }
}

// Get current user's role in a workspace
export async function getCurrentUserRole(projectId: string): Promise<string | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching user role:', error)
    return null
  }

  return data?.role || null
}

// Update workspace name and/or color
export async function updateWorkspace(
  projectId: string,
  updates: { name?: string; color?: string; logo_url?: string | null }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)

  if (error) {
    console.error('Error updating workspace:', error)
    throw error
  }
}
