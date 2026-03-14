import { createClient } from './client'
import type { PipelineItem } from '../types'

export async function loadPipelineItems(projectId: string): Promise<PipelineItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading pipeline items:', error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    client_id: row.client_id,
    amount: row.amount,
    expected_month: row.expected_month,
    label: row.label || '',
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

export async function createPipelineItem(
  projectId: string,
  item: { client_id: string; amount: number; expected_month: string; label?: string; sort_order: number }
): Promise<PipelineItem> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_items')
    .insert({ project_id: projectId, ...item })
    .select()
    .single()

  if (error) {
    console.error('Error creating pipeline item:', error)
    throw error
  }

  return data as PipelineItem
}

export async function updatePipelineItem(
  id: string,
  updates: Partial<Pick<PipelineItem, 'client_id' | 'amount' | 'expected_month' | 'label' | 'sort_order'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pipeline_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating pipeline item:', error)
    throw error
  }
}

export async function deletePipelineItem(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pipeline_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting pipeline item:', error)
    throw error
  }
}

export async function reorderPipelineItems(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  const supabase = createClient()
  for (const item of items) {
    const { error } = await supabase
      .from('pipeline_items')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
    if (error) {
      console.error('Error reordering pipeline item:', error)
      throw error
    }
  }
}
