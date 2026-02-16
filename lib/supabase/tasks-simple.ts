import { createClient } from './client'
import { getDefaultAreaId } from './initialize'
import type { Task } from '../types'

// Load all tasks for current user, grouped by day
export async function loadTasksByDay(userId: string): Promise<Record<string, Task[]>> {
  const supabase = createClient()
  const areaId = await getDefaultAreaId(userId)
  
  if (!areaId) return {}

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .order('sort_order')

  if (!tasks) return {}

  // Group by day
  const grouped: Record<string, Task[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  }

  tasks.forEach(task => {
    if (task.day && grouped[task.day]) {
      // Parse metadata from description
      let metadata: any = {}
      let actualDescription = task.description
      
      if (task.description && task.description.startsWith('__META__:')) {
        const parts = task.description.split('__META__:')
        if (parts[1]) {
          const metaEnd = parts[1].indexOf('__END__')
          if (metaEnd > -1) {
            try {
              metadata = JSON.parse(parts[1].substring(0, metaEnd))
              actualDescription = parts[1].substring(metaEnd + 7)
            } catch (e) {
              // Invalid JSON, ignore
            }
          }
        }
      }

      grouped[task.day].push({
        id: task.id,
        title: task.title,
        description: actualDescription,
        completed: task.completed,
        assignees: metadata.assignees || [],
        client: metadata.client,
        priority: metadata.priority,
        day: task.day,
      })
    }
  })

  return grouped
}

// Save a task (create or update)
// Returns the task ID (either existing or newly created UUID)
export async function saveTask(userId: string, task: Task): Promise<string> {
  const supabase = createClient()
  const areaId = await getDefaultAreaId(userId)
  
  if (!areaId) {
    throw new Error('No default area found')
  }

  // Encode metadata in description
  const metadata = {
    assignees: task.assignees || [],
    client: task.client,
    priority: task.priority,
  }
  
  const encodedDescription = task.description 
    ? `__META__:${JSON.stringify(metadata)}__END__${task.description}`
    : `__META__:${JSON.stringify(metadata)}__END__`

  const taskData = {
    area_id: areaId,
    title: task.title,
    description: encodedDescription,
    day: task.day || null,
    completed: task.completed || false,
    sort_order: 0,
  }

  // Check if task.id looks like a UUID (existing task) or temp ID (new task)
  const isExistingTask = task.id && task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

  if (isExistingTask) {
    // Update existing
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
    // Create new - let Supabase generate the UUID
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
export async function updateDayTasks(userId: string, day: string, tasks: Task[]) {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (task) {
      await saveTask(userId, { ...task, day })
    }
  }
}
