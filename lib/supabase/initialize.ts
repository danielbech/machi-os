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

  // Check if user already has any projects (via membership)
  // This covers both users who already had workspaces AND users
  // who just had pending invites accepted above
  const { data: existingMemberships } = await supabase
    .from('workspace_memberships')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingMemberships && existingMemberships.length > 0) {
    return
  }

  // New user with no invites — create their default workspace.
  // Use a lock check to prevent race conditions from multiple tabs:
  // re-check memberships right before creating to avoid duplicates.
  const { data: doubleCheck } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (doubleCheck && doubleCheck.length > 0) {
    // Another tab already created the project — just ensure membership exists
    const projectId = doubleCheck[0].id
    await supabase
      .from('workspace_memberships')
      .insert({ project_id: projectId, user_id: userId, role: 'owner' })
      .then(() => {}) // Ignore conflict errors (already exists)
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
  await supabase
    .from('workspace_memberships')
    .insert({
      project_id: project.id,
      user_id: userId,
      role: 'owner',
    })

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
  await seedDemoTasks(area.id, project.id)
}

// Seed demo tasks so new users see example cards on their board
export async function seedDemoTasks(areaId: string, projectId: string) {
  const supabase = createClient()

  // Create a demo client
  const { data: client } = await supabase
    .from('clients')
    .insert({
      project_id: projectId,
      name: 'Flowie',
      slug: 'flowie',
      color: 'orange',
      icon: '❤️',
      sort_order: 0,
      active: true,
    })
    .select('id')
    .single()

  const clientId = client?.id ?? null

  const { error } = await supabase.from('tasks').insert([
    {
      area_id: areaId,
      title: 'This is a note',
      description: 'Notes are for context — reminders, links, or anything that isn\'t a to-do. Tasks have priorities and can be completed.',
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
      client: clientId,
    },
    {
      area_id: areaId,
      title: 'Press ⌫ to delete a card',
      description: 'Select any card and press backspace to remove it.',
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
      title: 'Getting started',
      day: 'tuesday',
      type: 'task',
      priority: null,
      sort_order: 1,
      completed: false,
      assignees: [],
      checklist: [
        { id: crypto.randomUUID(), text: 'Add your first project', checked: false },
        { id: crypto.randomUUID(), text: 'Invite a teammate', checked: false },
        { id: crypto.randomUUID(), text: 'Connect Google Calendar', checked: false },
      ],
      client: clientId,
    },
    {
      area_id: areaId,
      title: 'Use spacebar to check a card',
      day: 'thursday',
      type: 'task',
      priority: 'medium',
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
