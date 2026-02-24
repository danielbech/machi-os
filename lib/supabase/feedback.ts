import { createClient } from './client'
import type { FeedbackTicket, FeedbackCategory } from '../types'

export async function loadFeedbackTickets(): Promise<FeedbackTicket[]> {
  const supabase = createClient()

  const { data: tickets, error } = await supabase
    .from('feedback_tickets')
    .select('id, user_id, title, description, category, status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading feedback tickets:', error)
    return []
  }

  if (!tickets || tickets.length === 0) return []

  // Batch-load author profiles
  const userIds = [...new Set(tickets.map(t => t.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, initials, color, avatar_url')
    .in('user_id', userIds)

  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  )

  return tickets.map(t => ({
    id: t.id,
    user_id: t.user_id,
    title: t.title,
    description: t.description,
    category: t.category as FeedbackCategory,
    status: t.status as FeedbackTicket['status'],
    created_at: t.created_at,
    author: profileMap.get(t.user_id)
      ? {
          display_name: profileMap.get(t.user_id)!.display_name,
          initials: profileMap.get(t.user_id)!.initials,
          color: profileMap.get(t.user_id)!.color,
          avatar_url: profileMap.get(t.user_id)!.avatar_url || undefined,
        }
      : undefined,
  }))
}

export async function createFeedbackTicket(
  userId: string,
  ticket: { title: string; description: string; category: FeedbackCategory },
  projectId?: string
): Promise<FeedbackTicket> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('feedback_tickets')
    .insert({
      user_id: userId,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      ...(projectId && { project_id: projectId }),
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
    created_at: data.created_at,
  }
}

export async function updateFeedbackTicket(
  ticketId: string,
  updates: { status?: FeedbackTicket['status'] }
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
