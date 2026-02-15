import { createClient } from './client'

// Initialize default project and area for new users
export async function initializeUserData(userId: string) {
  const supabase = createClient()

  console.log('Initializing user data for:', userId)

  // Check if user already has projects
  const { data: existingProjects, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (checkError) {
    console.error('Error checking existing projects:', checkError)
    throw checkError
  }

  console.log('Existing projects check result:', existingProjects)

  if (existingProjects && existingProjects.length > 0) {
    // User already initialized
    console.log('User already has projects, skipping initialization')
    return
  }

  console.log('Creating default project and area...')

  // Create default project
  console.log('Creating project...')
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
  console.log('Project created:', project.id)

  // Create workspace membership (owner)
  console.log('Creating workspace membership...')
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
  console.log('Membership created')

  // Create default area
  console.log('Creating area...')
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
  console.log('Area created')

  // Create default team members (from current hardcoded list)
  console.log('Creating team members...')
  const teamMembers = [
    { name: 'Daniel', initials: 'DB', color: 'bg-blue-500' },
    { name: 'Casper', initials: 'C', color: 'bg-green-500' },
    { name: 'Jens', initials: 'J', color: 'bg-purple-500' },
    { name: 'Emil', initials: 'E', color: 'bg-orange-500' },
  ]

  for (const member of teamMembers) {
    const { error } = await supabase.from('team_members').insert({
      user_id: userId,
      ...member,
    })
    if (error) {
      console.error('Error creating team member:', member.name, error)
    }
  }

  console.log('User initialization complete!')
}

// Get user's default area ID
// Now works with workspace memberships via RLS
export async function getDefaultAreaId(userId: string) {
  const supabase = createClient()

  console.log('Getting default area for user:', userId)

  // RLS will automatically filter to projects the user has membership in
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (projectError) {
    console.error('Error fetching project:', projectError)
    return null
  }

  if (!projects) {
    console.warn('No project found for user:', userId)
    return null
  }

  console.log('Found project:', projects.id)

  const { data: area, error: areaError } = await supabase
    .from('areas')
    .select('id')
    .eq('project_id', projects.id)
    .limit(1)
    .maybeSingle()

  if (areaError) {
    console.error('Error fetching area:', areaError)
    return null
  }

  if (!area) {
    console.warn('No area found for project:', projects.id)
    return null
  }

  console.log('Found area:', area.id)
  return area.id
}

// Get user's default project ID
export async function getDefaultProjectId(): Promise<string | null> {
  const supabase = createClient()

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }

  return projects?.id || null
}
