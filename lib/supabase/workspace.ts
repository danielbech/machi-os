import { createClient } from './client'

export interface WorkspaceMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  email?: string
}

// Get all members of the current workspace
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

  // Fetch user emails separately (they're in auth.users, not exposed via RLS)
  // For now, we'll just return the basic membership data
  return data || []
}

// Invite a user to the workspace by email
export async function inviteUserToWorkspace(
  projectId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<void> {
  const supabase = createClient()

  // First, check if user exists by email
  // Note: This requires a server-side function or admin API
  // For now, we'll create a simplified version that requires the user to exist

  // Get user ID from email (requires auth.users access - may need Edge Function)
  // Simplified: Just create an invite record and handle on user's next login
  
  const { error } = await supabase
    .from('workspace_memberships')
    .insert({
      project_id: projectId,
      // This won't work without getting user_id from email
      // We need to build this as an Edge Function or pending_invites table
      role,
    })

  if (error) {
    console.error('Error inviting user:', error)
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
