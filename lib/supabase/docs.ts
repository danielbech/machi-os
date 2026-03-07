import { createClient } from './client'
import type { Doc, DocComment } from '../types'

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
  updates: { title?: string; content?: Record<string, unknown>; icon?: string | null; cover_image?: string | null; parent_id?: string | null; sort_order?: number },
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

export async function duplicateDoc(docId: string, userId: string): Promise<Doc> {
  const supabase = createClient()

  // 1. Load the original doc
  const { data: original, error: loadError } = await supabase
    .from('docs')
    .select('*')
    .eq('id', docId)
    .single()

  if (loadError || !original) {
    console.error('Error loading doc for duplication:', loadError)
    throw loadError || new Error('Doc not found')
  }

  // 2. Create a new doc with same project_id, parent_id, title + " (copy)", content, icon
  // 3. Set sort_order to original + 1
  const { data, error } = await supabase
    .from('docs')
    .insert({
      project_id: original.project_id,
      created_by: userId,
      parent_id: original.parent_id,
      title: (original.title || 'Untitled') + ' (copy)',
      content: original.content || {},
      icon: original.icon || null,
      cover_image: original.cover_image || null,
      sort_order: (original.sort_order ?? 0) + 1,
    })
    .select()
    .single()

  if (error) {
    console.error('Error duplicating doc:', error)
    throw error
  }

  // 4. Return the new doc
  return mapDoc(data)
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

// ─── Reorder ─────────────────────────────────────────────────────────────────

export async function reorderDocs(
  updates: { id: string; parent_id: string | null; sort_order: number }[],
): Promise<void> {
  const supabase = createClient()
  const now = new Date().toISOString()
  await Promise.all(
    updates.map(({ id, parent_id, sort_order }) =>
      supabase
        .from('docs')
        .update({ parent_id, sort_order, updated_at: now })
        .eq('id', id)
    ),
  )
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchDocs(
  projectId: string,
  query: string,
): Promise<Doc[]> {
  const supabase = createClient()
  const q = `%${query}%`
  const { data, error } = await supabase
    .from('docs')
    .select('*')
    .eq('project_id', projectId)
    .or(`title.ilike.${q},content::text.ilike.${q}`)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error searching docs:', error)
    return []
  }

  return (data || []).map(mapDoc)
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function loadDocComments(docId: string): Promise<DocComment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('doc_comments')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error loading comments:', error)
    return []
  }

  return (data || []).map(mapComment)
}

export async function createDocComment(comment: {
  doc_id: string;
  project_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  selection?: string;
}): Promise<DocComment> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('doc_comments')
    .insert(comment)
    .select()
    .single()

  if (error) {
    console.error('Error creating comment:', error)
    throw error
  }

  return mapComment(data)
}

export async function updateDocComment(
  commentId: string,
  updates: { content?: string; resolved_at?: string | null },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('doc_comments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('Error updating comment:', error)
    throw error
  }
}

export async function deleteDocComment(commentId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('doc_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Error deleting comment:', error)
    throw error
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

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
    cover_image: row.cover_image || null,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: any): DocComment {
  return {
    id: row.id,
    doc_id: row.doc_id,
    project_id: row.project_id,
    user_id: row.user_id,
    parent_id: row.parent_id || null,
    content: row.content,
    selection: row.selection || null,
    resolved_at: row.resolved_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
