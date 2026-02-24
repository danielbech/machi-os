import { createClient } from './client'
import type { FeedbackTicket, FeedbackColumn, FeedbackCategory, ReactionType } from '../types'

const DEFAULT_COLUMNS = [
  { title: 'Feature requests', sort_order: 0 },
  { title: 'Bugs', sort_order: 1 },
  { title: 'Working on', sort_order: 2 },
  { title: 'Rejected', sort_order: 3 },
]

// --- Columns ---

export async function ensureDefaultColumns(projectId: string): Promise<FeedbackColumn[]> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('feedback_columns')
    .select('id, project_id, title, sort_order')
    .eq('project_id', projectId)
    .order('sort_order')

  if (existing && existing.length > 0) return existing

  const { data: created, error } = await supabase
    .from('feedback_columns')
    .insert(DEFAULT_COLUMNS.map(c => ({ project_id: projectId, ...c })))
    .select('id, project_id, title, sort_order')
    .order('sort_order')

  if (error) {
    console.error('Error creating default columns:', error)
    return []
  }

  return created || []
}

export async function loadFeedbackColumns(projectId: string): Promise<FeedbackColumn[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('feedback_columns')
    .select('id, project_id, title, sort_order')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading feedback columns:', error)
    return []
  }

  return data || []
}

export async function createFeedbackColumn(
  projectId: string,
  title: string,
  sortOrder: number
): Promise<FeedbackColumn | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('feedback_columns')
    .insert({ project_id: projectId, title, sort_order: sortOrder })
    .select('id, project_id, title, sort_order')
    .single()

  if (error) {
    console.error('Error creating feedback column:', error)
    return null
  }

  return data
}

export async function updateFeedbackColumn(
  columnId: string,
  updates: { title?: string; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('feedback_columns')
    .update(updates)
    .eq('id', columnId)

  if (error) {
    console.error('Error updating feedback column:', error)
    throw error
  }
}

export async function deleteFeedbackColumn(columnId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('feedback_columns')
    .delete()
    .eq('id', columnId)

  if (error) {
    console.error('Error deleting feedback column:', error)
    throw error
  }
}

export async function reorderFeedbackColumns(columns: { id: string; sort_order: number }[]): Promise<void> {
  const supabase = createClient()

  // Batch update sort_order for each column
  const updates = columns.map(c =>
    supabase.from('feedback_columns').update({ sort_order: c.sort_order }).eq('id', c.id)
  )

  await Promise.all(updates)
}

// --- Tickets ---

export async function loadFeedbackTickets(
  projectId: string,
  userId: string
): Promise<Record<string, FeedbackTicket[]>> {
  const supabase = createClient()

  const { data: tickets, error } = await supabase
    .from('feedback_tickets')
    .select('id, user_id, title, description, category, status, column_id, sort_order, created_at')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading feedback tickets:', error)
    return {}
  }

  if (!tickets || tickets.length === 0) return {}

  // Batch-load author profiles
  const userIds = [...new Set(tickets.map(t => t.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, initials, color, avatar_url')
    .in('user_id', userIds)

  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  )

  // Load reactions per ticket
  const ticketIds = tickets.map(t => t.id)
  const { data: votes } = await supabase
    .from('feedback_votes')
    .select('ticket_id, user_id, reaction_type')
    .in('ticket_id', ticketIds)

  // { ticketId -> { reaction_type -> count } }
  const reactionCounts = new Map<string, Record<ReactionType, number>>()
  // { ticketId -> ReactionType[] } for current user
  const userReactions = new Map<string, ReactionType[]>()

  for (const v of votes || []) {
    const rt = v.reaction_type as ReactionType
    if (!reactionCounts.has(v.ticket_id)) {
      reactionCounts.set(v.ticket_id, { thumbsup: 0, heart: 0, fire: 0 })
    }
    reactionCounts.get(v.ticket_id)![rt]++
    if (v.user_id === userId) {
      if (!userReactions.has(v.ticket_id)) userReactions.set(v.ticket_id, [])
      userReactions.get(v.ticket_id)!.push(rt)
    }
  }

  // Group by column_id
  const grouped: Record<string, FeedbackTicket[]> = {}

  for (const t of tickets) {
    const key = t.column_id || 'unassigned'
    const profile = profileMap.get(t.user_id)

    const ticket: FeedbackTicket = {
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      description: t.description,
      category: t.category as FeedbackCategory,
      status: t.status as FeedbackTicket['status'],
      column_id: t.column_id,
      sort_order: t.sort_order,
      reactions: reactionCounts.get(t.id) || { thumbsup: 0, heart: 0, fire: 0 },
      user_reactions: userReactions.get(t.id) || [],
      created_at: t.created_at,
      author: profile
        ? {
            display_name: profile.display_name,
            initials: profile.initials,
            color: profile.color,
            avatar_url: profile.avatar_url || undefined,
          }
        : undefined,
    }

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ticket)
  }

  return grouped
}

export async function createFeedbackTicket(
  userId: string,
  ticket: { title: string; description: string; column_id: string },
  projectId: string
): Promise<FeedbackTicket> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('feedback_tickets')
    .insert({
      user_id: userId,
      title: ticket.title,
      description: ticket.description,
      column_id: ticket.column_id,
      category: 'feedback',
      project_id: projectId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating feedback ticket:', error)
    throw error
  }

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    description: data.description,
    category: data.category as FeedbackCategory,
    status: data.status as FeedbackTicket['status'],
    column_id: data.column_id,
    sort_order: data.sort_order ?? 0,
    reactions: { thumbsup: 0, heart: 0, fire: 0 },
    user_reactions: [],
    created_at: data.created_at,
  }
}

export async function updateFeedbackTicket(
  ticketId: string,
  updates: { title?: string; description?: string; column_id?: string; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('feedback_tickets')
    .update(updates)
    .eq('id', ticketId)

  if (error) {
    console.error('Error updating feedback ticket:', error)
    throw error
  }
}

export async function deleteFeedbackTicket(ticketId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('feedback_tickets')
    .delete()
    .eq('id', ticketId)

  if (error) {
    console.error('Error deleting feedback ticket:', error)
    throw error
  }
}

export async function reorderFeedbackTickets(
  columnId: string,
  tickets: FeedbackTicket[]
): Promise<void> {
  const supabase = createClient()

  const updates = tickets
    .filter(t => t.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
    .map((t, i) => ({
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      description: t.description,
      category: t.category,
      column_id: columnId,
      sort_order: i,
    }))

  if (updates.length === 0) return

  const { error } = await supabase
    .from('feedback_tickets')
    .upsert(updates)

  if (error) {
    console.error('Error reordering feedback tickets:', error)
    throw error
  }
}

// --- Votes ---

export async function toggleFeedbackVote(
  ticketId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ voted: boolean }> {
  const supabase = createClient()

  // Check if vote exists for this reaction type
  const { data: existing } = await supabase
    .from('feedback_votes')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
    .maybeSingle()

  if (existing) {
    // Remove vote
    await supabase
      .from('feedback_votes')
      .delete()
      .eq('id', existing.id)

    return { voted: false }
  } else {
    // Add vote
    const { error } = await supabase
      .from('feedback_votes')
      .insert({ ticket_id: ticketId, user_id: userId, reaction_type: reactionType })

    if (error) {
      console.error('Error adding vote:', error)
      throw error
    }

    return { voted: true }
  }
}
