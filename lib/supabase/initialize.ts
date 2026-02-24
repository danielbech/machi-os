import { createClient } from './client'
import { getOrCreateProfile } from './profiles'

// Initialize default project and area for new users
export async function initializeUserData(userId: string) {
  const supabase = createClient()

  // Ensure the user has a profile
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    await getOrCreateProfile(userId, user.email)
  }

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
  const { data: area, error: areaError } = await supabase
    .from('areas')
    .insert({
      project_id: project.id,
      name: 'General',
      sort_order: 0,
    })
    .select()
    .single()

  if (areaError) {
    console.error('Error creating area:', areaError)
    throw areaError
  }

  // Seed demo tasks for new users
  await seedDemoTasks(area.id)
}

// Seed demo tasks so new users see example cards on their board
export async function seedDemoTasks(areaId: string) {
  const supabase = createClient()

  const { error } = await supabase.from('tasks').insert([
    {
      area_id: areaId,
      title: 'This is your weekly board',
      description: 'Each column is a day of the week. Drag cards between days to plan your work. Cards carry over automatically if not completed by end of week.',
      day: 'monday',
      type: 'note',
      priority: null,
      sort_order: 0,
      completed: false,
      assignees: [],
      checklist: [],
    },
    {
      area_id: areaId,
      title: 'Try dragging this card to another day',
      day: 'monday',
      type: 'task',
      priority: 'medium',
      sort_order: 1,
      completed: false,
      assignees: [],
      checklist: [],
    },
    {
      area_id: areaId,
      title: 'Press . to open the backlog',
      description: 'The backlog is your inbox for unsorted tasks. Organize them by project, then drag onto the board when you\'re ready to schedule.',
      day: 'tuesday',
      type: 'task',
      priority: 'medium',
      sort_order: 0,
      completed: false,
      assignees: [],
      checklist: [],
    },
    {
      area_id: areaId,
      title: 'Plan ahead on the Timeline',
      description: 'Open the Timeline tab in the sidebar to visualize long-term projects on a Gantt-style chart. Great for tracking deadlines across weeks.',
      day: 'wednesday',
      type: 'task',
      priority: 'high',
      sort_order: 0,
      completed: false,
      assignees: [],
      checklist: [],
    },
    {
      area_id: areaId,
      title: 'Getting started',
      day: 'thursday',
      type: 'task',
      priority: 'medium',
      sort_order: 0,
      completed: false,
      assignees: [],
      checklist: [
        { id: crypto.randomUUID(), text: 'Add your first project', checked: false },
        { id: crypto.randomUUID(), text: 'Invite a teammate', checked: false },
        { id: crypto.randomUUID(), text: 'Connect Google Calendar', checked: false },
      ],
    },
    {
      area_id: areaId,
      title: 'Share your feedback',
      description: 'Head to the Feedback tab in the sidebar — we\'d love to hear what you think and what features you want next.',
      day: 'friday',
      type: 'task',
      priority: 'low',
      sort_order: 0,
      completed: false,
      assignees: [],
      checklist: [],
    },
  ])

  if (error) {
    console.error('Error seeding demo tasks:', error)
    // Non-fatal — don't throw, the workspace is still usable
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
