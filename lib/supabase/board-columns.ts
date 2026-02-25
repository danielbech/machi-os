import { createClient } from './client'
import type { BoardColumn } from '../types'

export async function loadBoardColumns(projectId: string): Promise<BoardColumn[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('board_columns')
    .select('id, project_id, title, sort_order')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading board columns:', error)
    return []
  }

  return data || []
}

export async function createBoardColumn(
  projectId: string,
  title: string,
  sortOrder: number
): Promise<BoardColumn> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('board_columns')
    .insert({ project_id: projectId, title, sort_order: sortOrder })
    .select('id, project_id, title, sort_order')
    .single()

  if (error) {
    console.error('Error creating board column:', error)
    throw error
  }

  return data
}

export async function updateBoardColumn(
  columnId: string,
  updates: { title?: string; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('board_columns')
    .update(updates)
    .eq('id', columnId)

  if (error) {
    console.error('Error updating board column:', error)
    throw error
  }
}

export async function deleteBoardColumn(columnId: string): Promise<void> {
  const supabase = createClient()

  // Delete tasks in this column first
  await supabase.from('tasks').delete().eq('day', columnId)

  const { error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', columnId)

  if (error) {
    console.error('Error deleting board column:', error)
    throw error
  }
}

export async function reorderBoardColumns(columns: { id: string; sort_order: number }[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('board_columns')
    .upsert(columns.map(c => ({ id: c.id, sort_order: c.sort_order })))

  if (error) {
    console.error('Error reordering board columns:', error)
    throw error
  }
}
