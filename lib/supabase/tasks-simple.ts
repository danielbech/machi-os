import { createClient } from './client'
import { getAreaIdForProject } from './initialize'
import type { Task, DayName } from '../types'

async function resolveAreaId(projectId: string, areaId?: string | null): Promise<string | null> {
  if (areaId) return areaId
  return getAreaIdForProject(projectId)
}

// Load all tasks for a project, grouped by day (or by custom column ID)
export async function loadTasksByDay(projectId: string, cachedAreaId?: string | null, customColumnIds?: string[]): Promise<Record<string, Task[]>> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)

  if (!areaId) return {}

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, completed, assignees, client, priority, day, type, folder_id, checklist, images, sort_order')
    .eq('area_id', areaId)
    .order('sort_order')

  if (!tasks) return {}

  const grouped: Record<string, Task[]> = {}

  if (customColumnIds) {
    // Custom mode: group by column UUID
    for (const colId of customColumnIds) {
      grouped[colId] = []
    }
  } else {
    // Standard mode: group by weekday
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      grouped[day] = []
    }
  }

  tasks.forEach(task => {
    if (task.day && grouped[task.day]) {
      grouped[task.day].push({
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        completed: task.completed,
        assignees: task.assignees || [],
        client: task.client || undefined,
        priority: task.priority || undefined,
        day: task.day as DayName,
        type: task.type || 'task',
        folder_id: task.folder_id || undefined,
        checklist: task.checklist || [],
        images: task.images || [],
      })
    }
  })

  return grouped
}

// Save a task (create or update)
export async function saveTask(projectId: string, task: Task, cachedAreaId?: string | null): Promise<string> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)

  if (!areaId) {
    throw new Error('No area found for project')
  }

  const isExistingTask = task.id && task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

  if (isExistingTask) {
    // Only update fields that the UI changes — never touch sort_order
    const { error } = await supabase
      .from('tasks')
      .update({
        title: task.title,
        description: task.description || null,
        day: task.day || null,
        completed: task.completed || false,
        assignees: task.assignees || [],
        client: task.client || null,
        priority: task.priority || null,
        type: task.type || 'task',
        folder_id: task.folder_id || null,
        checklist: task.checklist || [],
        images: task.images || [],
      })
      .eq('id', task.id)

    if (error) {
      console.error('Error updating task:', error)
      throw error
    }
    return task.id
  } else {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        area_id: areaId,
        title: task.title,
        description: task.description || null,
        day: task.day || null,
        completed: task.completed || false,
        sort_order: 0,
        assignees: task.assignees || [],
        client: task.client || null,
        priority: task.priority || null,
        type: task.type || 'task',
        folder_id: task.folder_id || null,
        checklist: task.checklist || [],
        images: task.images || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      throw error
    }
    return data.id
  }
}

// Delete a task
export async function deleteTask(taskId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) {
    console.error('Error deleting task:', error)
    throw error
  }
}

// Update all tasks for a specific day (batch update for reordering)
export async function updateDayTasks(projectId: string, day: string, tasks: Task[], cachedAreaId?: string | null) {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return

  const updates = tasks
    .filter(task => task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
    .map((task, i) => ({
      id: task.id,
      area_id: areaId,
      title: task.title,
      description: task.description || null,
      day,
      completed: task.completed || false,
      sort_order: i,
      assignees: task.assignees || [],
      client: task.client || null,
      priority: task.priority || null,
      type: task.type || 'task',
      folder_id: task.folder_id || null,
      checklist: task.checklist || [],
      images: task.images || [],
    }))

  if (updates.length === 0) return

  const { error } = await supabase
    .from('tasks')
    .upsert(updates)

  if (error) {
    console.error('Error batch updating tasks:', error)
    throw error
  }
}

// Batch update backlog task order (sort_order + folder_id)
export async function updateBacklogTaskOrder(projectId: string, tasks: Task[], cachedAreaId?: string | null) {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return

  const updates = tasks
    .filter(task => task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
    .map((task, i) => ({
      id: task.id,
      area_id: areaId,
      title: task.title,
      description: task.description || null,
      day: task.day || null,
      completed: task.completed || false,
      sort_order: i,
      assignees: task.assignees || [],
      client: task.client || null,
      priority: task.priority || null,
      type: task.type || 'task',
      folder_id: task.folder_id || null,
      checklist: task.checklist || [],
      images: task.images || [],
    }))

  if (updates.length === 0) return

  const { error } = await supabase
    .from('tasks')
    .upsert(updates)

  if (error) {
    console.error('Error batch updating backlog task order:', error)
    throw error
  }
}

// Transition week: delete completed board tasks, move incomplete to Monday
export async function transitionWeek(projectId: string, cachedAreaId?: string | null): Promise<{ deleted: number; carriedOver: number }> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)

  if (!areaId) return { deleted: 0, carriedOver: 0 }

  // Get all board tasks (day IS NOT NULL)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .not('day', 'is', null)

  if (!tasks || tasks.length === 0) return { deleted: 0, carriedOver: 0 }

  const notes = tasks.filter(t => t.type === 'note' || t.type === 'divider')
  const completed = tasks.filter(t => t.completed && t.type !== 'note' && t.type !== 'divider')
  const incomplete = tasks.filter(t => !t.completed && t.type !== 'note' && t.type !== 'divider')

  // Delete completed tasks and all notes
  const toDelete = [...completed, ...notes]
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .in('id', toDelete.map(t => t.id))
    if (deleteError) {
      console.error('Error deleting tasks during transition:', deleteError)
      throw deleteError
    }
  }

  // Move incomplete tasks to Monday with sequential sort_order (batch upsert)
  if (incomplete.length > 0) {
    const updates = incomplete.map((t, i) => ({
      id: t.id,
      area_id: areaId,
      title: t.title,
      description: t.description || null,
      day: 'monday',
      completed: false,
      sort_order: i,
      assignees: t.assignees || [],
      client: t.client || null,
      priority: t.priority || null,
      type: t.type || 'task',
      folder_id: t.folder_id || null,
      checklist: t.checklist || [],
      images: t.images || [],
    }))
    const { error: updateError } = await supabase.from('tasks').upsert(updates)
    if (updateError) {
      console.error('Error moving tasks to Monday:', updateError)
      throw updateError
    }
  }

  return { deleted: toDelete.length, carriedOver: incomplete.length }
}

// Count board tasks that would be orphaned when switching modes
export async function countBoardTasksForMode(
  projectId: string,
  currentMode: 'weekly' | 'custom',
  cachedAreaId?: string | null
): Promise<number> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return 0

  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, day')
    .eq('area_id', areaId)
    .not('day', 'is', null)

  if (!tasks) return 0

  if (currentMode === 'weekly') {
    // Count tasks with weekday names (these would be orphaned when switching to custom)
    return tasks.filter(t => weekdays.includes(t.day!)).length
  } else {
    // Count tasks with non-weekday day values (UUIDs — these would be orphaned when switching to weekly)
    return tasks.filter(t => !weekdays.includes(t.day!)).length
  }
}

// Migrate board tasks when switching between weekly and custom modes
export async function migrateBoardTasks(
  projectId: string,
  direction: 'weekly-to-custom' | 'custom-to-weekly',
  targetColumnId: string,
  cachedAreaId?: string | null
): Promise<number> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return 0

  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .not('day', 'is', null)

  if (!tasks || tasks.length === 0) return 0

  let toMigrate: typeof tasks
  if (direction === 'weekly-to-custom') {
    toMigrate = tasks.filter(t => weekdays.includes(t.day!))
  } else {
    toMigrate = tasks.filter(t => !weekdays.includes(t.day!))
  }

  if (toMigrate.length === 0) return 0

  // Get current max sort_order in the target column
  const { data: existingInTarget } = await supabase
    .from('tasks')
    .select('sort_order')
    .eq('area_id', areaId)
    .eq('day', targetColumnId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const startOrder = existingInTarget && existingInTarget.length > 0
    ? existingInTarget[0].sort_order + 1
    : 0

  const updates = toMigrate.map((t, i) => ({
    id: t.id,
    area_id: areaId,
    title: t.title,
    description: t.description || null,
    day: targetColumnId,
    completed: t.completed || false,
    sort_order: startOrder + i,
    assignees: t.assignees || [],
    client: t.client || null,
    priority: t.priority || null,
    type: t.type || 'task',
    folder_id: t.folder_id || null,
    checklist: t.checklist || [],
    images: t.images || [],
  }))

  const { error } = await supabase.from('tasks').upsert(updates)
  if (error) {
    console.error('Error migrating board tasks:', error)
    throw error
  }

  return toMigrate.length
}

// Load backlog tasks (have a client, NOT on the kanban)
export async function loadBacklogTasks(projectId: string, cachedAreaId?: string | null): Promise<Task[]> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)

  if (!areaId) return []

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .not('client', 'is', null)
    .is('day', null)
    .order('sort_order')

  if (error) {
    console.error('Error loading backlog tasks:', error)
    return []
  }

  return (tasks || []).map(task => ({
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    completed: task.completed,
    assignees: task.assignees || [],
    client: task.client || undefined,
    priority: task.priority || undefined,
    day: (task.day as DayName) || undefined,
    type: task.type || 'task',
    folder_id: task.folder_id || undefined,
    checklist: task.checklist || [],
    images: task.images || [],
  }))
}
