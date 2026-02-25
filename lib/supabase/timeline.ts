import { createClient } from './client'
import type { TimelineEntry, TimelineMarker } from '../types'

export async function loadTimelineEntries(projectId: string): Promise<TimelineEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('timeline_entries')
    .select('id, project_id, client_id, parent_id, title, start_date, end_date, color, icon, sort_order, type, created_at')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading timeline entries:', error)
    return []
  }

  return (data || []).map(e => ({
    id: e.id,
    project_id: e.project_id,
    client_id: e.client_id || undefined,
    parent_id: e.parent_id || undefined,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date,
    color: e.color,
    icon: e.icon || undefined,
    sort_order: e.sort_order,
    type: e.type || 'project',
    created_at: e.created_at,
  }))
}

export async function createTimelineEntry(
  projectId: string,
  entry: { client_id?: string; parent_id?: string; title: string; start_date: string; end_date: string; color: string; icon?: string; sort_order: number; type?: string }
): Promise<TimelineEntry> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('timeline_entries')
    .insert({
      project_id: projectId,
      client_id: entry.client_id || null,
      parent_id: entry.parent_id || null,
      title: entry.title,
      start_date: entry.start_date,
      end_date: entry.end_date,
      color: entry.color,
      icon: entry.icon || null,
      sort_order: entry.sort_order,
      type: entry.type || 'project',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating timeline entry:', error)
    throw error
  }

  return {
    id: data.id,
    project_id: data.project_id,
    client_id: data.client_id || undefined,
    parent_id: data.parent_id || undefined,
    title: data.title,
    start_date: data.start_date,
    end_date: data.end_date,
    color: data.color,
    icon: data.icon || undefined,
    sort_order: data.sort_order,
    type: data.type || 'project',
    created_at: data.created_at,
  }
}

export async function updateTimelineEntry(
  entryId: string,
  updates: { title?: string; start_date?: string; end_date?: string; color?: string; icon?: string | null; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('timeline_entries')
    .update(updates)
    .eq('id', entryId)

  if (error) {
    console.error('Error updating timeline entry:', error)
    throw error
  }
}

export async function deleteTimelineEntry(entryId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('timeline_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    console.error('Error deleting timeline entry:', error)
    throw error
  }
}

// --- Markers ---

export async function loadTimelineMarkers(projectId: string): Promise<TimelineMarker[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('timeline_markers')
    .select('id, project_id, label, date, entry_id, created_at')
    .eq('project_id', projectId)
    .order('date')

  if (error) {
    console.error('Error loading timeline markers:', error)
    return []
  }

  return (data || []).map(m => ({
    id: m.id,
    project_id: m.project_id,
    label: m.label,
    date: m.date,
    entry_id: m.entry_id || undefined,
    created_at: m.created_at,
  }))
}

export async function createTimelineMarker(
  projectId: string,
  marker: { label: string; date: string; entry_id?: string }
): Promise<TimelineMarker> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('timeline_markers')
    .insert({
      project_id: projectId,
      label: marker.label,
      date: marker.date,
      entry_id: marker.entry_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating timeline marker:', error)
    throw error
  }

  return {
    id: data.id,
    project_id: data.project_id,
    label: data.label,
    date: data.date,
    entry_id: data.entry_id || undefined,
    created_at: data.created_at,
  }
}

export async function updateTimelineMarker(
  markerId: string,
  updates: { label?: string; date?: string }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('timeline_markers')
    .update(updates)
    .eq('id', markerId)

  if (error) {
    console.error('Error updating timeline marker:', error)
    throw error
  }
}

export async function deleteTimelineMarker(markerId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('timeline_markers')
    .delete()
    .eq('id', markerId)

  if (error) {
    console.error('Error deleting timeline marker:', error)
    throw error
  }
}
