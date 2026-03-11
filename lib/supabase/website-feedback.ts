import { createClient } from './client'
import type { WebsiteFeedbackBoard, WebsiteFeedbackItem } from '../types'

// ─── Boards ─────────────────────────────────────────────────────────────────

export async function loadFeedbackBoards(projectId: string): Promise<WebsiteFeedbackBoard[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('website_feedback_boards')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading feedback boards:', error)
    return []
  }
  return (data || []).map(row => ({
    ...row,
    statuses: Array.isArray(row.statuses) ? row.statuses : JSON.parse(row.statuses as string),
  }))
}

export async function createFeedbackBoard(
  projectId: string,
  clientId: string,
  title: string = 'Website Feedback'
): Promise<WebsiteFeedbackBoard> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('website_feedback_boards')
    .insert({ project_id: projectId, client_id: clientId, title })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    statuses: Array.isArray(data.statuses) ? data.statuses : JSON.parse(data.statuses as string),
  }
}

export async function updateFeedbackBoard(
  boardId: string,
  updates: Partial<Pick<WebsiteFeedbackBoard, 'title' | 'statuses'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('website_feedback_boards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', boardId)

  if (error) throw error
}

export async function deleteFeedbackBoard(boardId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('website_feedback_boards')
    .delete()
    .eq('id', boardId)

  if (error) throw error
}

// ─── Items ──────────────────────────────────────────────────────────────────

export async function loadFeedbackItems(boardId: string): Promise<WebsiteFeedbackItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('website_feedback_items')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading feedback items:', error)
    return []
  }
  return (data || []).map(row => ({
    ...row,
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : JSON.parse(row.media_urls as string),
  }))
}

export async function createFeedbackItem(
  boardId: string,
  projectId: string,
  item: {
    description: string;
    status?: string;
    media_urls?: string[];
    submitted_by?: string;
    user_id?: string;
  }
): Promise<WebsiteFeedbackItem> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('website_feedback_items')
    .insert({
      board_id: boardId,
      project_id: projectId,
      description: item.description,
      status: item.status || 'New',
      media_urls: item.media_urls || [],
      submitted_by: item.submitted_by || null,
      user_id: item.user_id || null,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    media_urls: Array.isArray(data.media_urls) ? data.media_urls : JSON.parse(data.media_urls as string),
  }
}

export async function updateFeedbackItem(
  itemId: string,
  updates: Partial<Pick<WebsiteFeedbackItem, 'description' | 'status' | 'media_urls' | 'resolution_note'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('website_feedback_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) throw error
}

export async function deleteFeedbackItem(itemId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('website_feedback_items')
    .delete()
    .eq('id', itemId)

  if (error) throw error
}

// ─── Shared (public) access via token ───────────────────────────────────────

export async function loadFeedbackBoardByToken(token: string): Promise<{
  board: WebsiteFeedbackBoard;
  items: WebsiteFeedbackItem[];
  clientName: string;
  clientLogoUrl: string | null;
} | null> {
  const { createAdminClient } = await import('./server')
  const supabase = createAdminClient()

  const { data: board } = await supabase
    .from('website_feedback_boards')
    .select('*')
    .eq('share_token', token)
    .single()

  if (!board) return null

  const { data: items } = await supabase
    .from('website_feedback_items')
    .select('*')
    .eq('board_id', board.id)
    .order('created_at', { ascending: false })

  const { data: client } = await supabase
    .from('clients')
    .select('name, logo_url')
    .eq('id', board.client_id)
    .single()

  return {
    board: {
      ...board,
      statuses: Array.isArray(board.statuses) ? board.statuses : JSON.parse(board.statuses as string),
    },
    items: (items || []).map(row => ({
      ...row,
      media_urls: Array.isArray(row.media_urls) ? row.media_urls : JSON.parse(row.media_urls as string),
    })),
    clientName: client?.name || 'Client',
    clientLogoUrl: client?.logo_url || null,
  }
}

// ─── Public submission (via API route, uses admin client) ───────────────────

export async function submitFeedbackItem(
  token: string,
  item: {
    description: string;
    submitted_by: string;
    media_urls?: string[];
  }
): Promise<WebsiteFeedbackItem | null> {
  const { createAdminClient } = await import('./server')
  const supabase = createAdminClient()

  // Look up board by token
  const { data: board } = await supabase
    .from('website_feedback_boards')
    .select('id, project_id')
    .eq('share_token', token)
    .single()

  if (!board) return null

  const { data, error } = await supabase
    .from('website_feedback_items')
    .insert({
      board_id: board.id,
      project_id: board.project_id,
      description: item.description,
      status: 'New',
      media_urls: item.media_urls || [],
      submitted_by: item.submitted_by,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    media_urls: Array.isArray(data.media_urls) ? data.media_urls : JSON.parse(data.media_urls as string),
  }
}
