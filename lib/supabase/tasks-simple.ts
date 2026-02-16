import { createClient } from './client'
import { getAreaIdForProject } from './initialize'
import type { Task } from '../types'

// Load all tasks for a project, grouped by day
export async function loadTasksByDay(projectId: string): Promise<Record<string, Task[]>> {
  const supabase = createClient()
  const areaId = await getAreaIdForProject(projectId)

  if (!areaId) return {}

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .order('sort_order')

  if (!tasks) return {}

  const grouped: Record<string, Task[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
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
        day: task.day,
      })
    }
  })

  return grouped
}

// Save a task (create or update)
export async function saveTask(projectId: string, task: Task): Promise<string> {
  const supabase = createClient()
  const areaId = await getAreaIdForProject(projectId)

  if (!areaId) {
    throw new Error('No area found for project')
  }

  const taskData = {
    area_id: areaId,
    title: task.title,
    description: task.description || null,
    day: task.day || null,
    completed: task.completed || false,
    sort_order: 0,
    assignees: task.assignees || [],
    client: task.client || null,
    priority: task.priority || null,
  }

  const isExistingTask = task.id && task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

  if (isExistingTask) {
    const { error } = await supabase
      .from('tasks')
      .update(taskData)
      .eq('id', task.id)

    if (error) {
      console.error('Error updating task:', error)
      throw error
    }
    return task.id
  } else {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
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
  await supabase.from('tasks').delete().eq('id', taskId)
}

// Update all tasks for a specific day (batch update for reordering)
export async function updateDayTasks(projectId: string, day: string, tasks: Task[]) {
  const supabase = createClient()
  const areaId = await getAreaIdForProject(projectId)
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
