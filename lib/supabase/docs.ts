import { createClient } from './client'
import type { Doc } from '../types'

export async function loadDocs(projectId: string): Promise<Doc[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('docs')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error loading docs:', error)
    return []
  }

  return (data || []).map(mapDoc)
}

export async function createDoc(
  projectId: string,
  createdBy: string,
  parentId: string | null = null,
  sortOrder: number = 0,
): Promise<Doc> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('docs')
    .insert({
      project_id: projectId,
      created_by: createdBy,
      parent_id: parentId,
      title: 'Untitled',
      content: {},
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating doc:', error)
    throw error
  }

  return mapDoc(data)
}

export async function updateDoc(
  docId: string,
  updates: { title?: string; content?: Record<string, unknown>; icon?: string | null; parent_id?: string | null; sort_order?: number },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('docs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', docId)

  if (error) {
    console.error('Error updating doc:', error)
    throw error
  }
}

export async function deleteDoc(docId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('docs')
    .delete()
    .eq('id', docId)

  if (error) {
    console.error('Error deleting doc:', error)
    throw error
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoc(row: any): Doc {
  return {
    id: row.id,
    project_id: row.project_id,
    parent_id: row.parent_id || null,
    created_by: row.created_by,
    title: row.title,
    content: row.content || {},
    icon: row.icon || null,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
