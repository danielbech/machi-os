import { createClient } from './client'

// Initialize default project and area for new users
export async function initializeUserData(userId: string) {
  const supabase = createClient()

  // Accept any pending invites for this user
  await supabase.rpc('accept_pending_invites').then(({ error }) => {
    if (error) console.error('Error accepting pending invites:', error)
  })

  // Check if user already has any projects (via membership)
  const { data: existingMemberships } = await supabase
    .from('workspace_memberships')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingMemberships && existingMemberships.length > 0) {
    return
  }

  // Create default project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'My Workspace',
      color: '#3b82f6', // blue
    })
    .select()
    .single()

  if (projectError) {
    console.error('Error creating project:', projectError)
    throw projectError
  }

  // Create workspace membership (owner)
  const { error: membershipError } = await supabase
    .from('workspace_memberships')
    .insert({
      project_id: project.id,
      user_id: userId,
      role: 'owner',
    })

  if (membershipError) {
    console.error('Error creating membership:', membershipError)
    throw membershipError
  }

  // Create default area
  const { error: areaError } = await supabase
    .from('areas')
    .insert({
      project_id: project.id,
      name: 'General',
      sort_order: 0,
    })

  if (areaError) {
    console.error('Error creating area:', areaError)
    throw areaError
  }

  // Create default team members
  const { error: teamError } = await supabase.from('team_members').insert([
    { user_id: userId, name: 'Daniel', initials: 'DB', color: 'bg-blue-500' },
    { user_id: userId, name: 'Casper', initials: 'C', color: 'bg-green-500' },
    { user_id: userId, name: 'Jens', initials: 'J', color: 'bg-purple-500' },
    { user_id: userId, name: 'Emil', initials: 'E', color: 'bg-orange-500' },
  ])

  if (teamError) {
    console.error('Error creating team members:', teamError)
  }
}

// Get area ID for a specific project
export async function getAreaIdForProject(projectId: string) {
  const supabase = createClient()

  const { data: area, error } = await supabase
    .from('areas')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching area:', error)
    return null
  }

  return area?.id || null
}
