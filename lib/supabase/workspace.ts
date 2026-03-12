import { createClient } from './client'
import type { Project } from '../types'

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
