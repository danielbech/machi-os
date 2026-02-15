import { createClient } from './client'

// Initialize default project and area for new users
export async function initializeUserData(userId: string) {
  const supabase = createClient()

  console.log('Initializing user data for:', userId)

  // Check if user already has projects
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingProjects && existingProjects.length > 0) {
    // User already initialized
    console.log('User already has projects, skipping initialization')
    return
  }

  console.log('Creating default project and area...')

  // Create default project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'My Projects',
      color: '#3b82f6', // blue
    })
    .select()
    .single()

  if (projectError) throw projectError

  // Create default area
  const { error: areaError } = await supabase
    .from('areas')
    .insert({
      project_id: project.id,
      name: 'General',
      sort_order: 0,
    })

  if (areaError) throw areaError

  // Create default team members (from current hardcoded list)
  const teamMembers = [
    { name: 'Daniel', initials: 'DB', color: 'bg-blue-500' },
    { name: 'Casper', initials: 'C', color: 'bg-green-500' },
    { name: 'Jens', initials: 'J', color: 'bg-purple-500' },
    { name: 'Emil', initials: 'E', color: 'bg-orange-500' },
  ]

  for (const member of teamMembers) {
    await supabase.from('team_members').insert({
      user_id: userId,
      ...member,
    })
  }

  console.log('User initialization complete!')
}

// Get user's default area ID
export async function getDefaultAreaId(userId: string) {
  const supabase = createClient()

  console.log('Getting default area for user:', userId)

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
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
