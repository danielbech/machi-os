import { createClient } from './client'

export interface CalendarConnection {
  id: string
  project_id: string
  user_id: string
  access_token: string
  expires_at: string
  selected_calendars: string[]
}

export interface DbCalendarEvent {
  id: string
  project_id: string
  user_id: string
  google_event_id: string
  calendar_id: string
  summary: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  synced_at: string
}

// Upsert the current user's calendar connection for a workspace
export async function saveCalendarConnection(
  projectId: string,
  accessToken: string,
  expiresAt: Date,
  selectedCalendars: string[] = ['primary']
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('calendar_connections')
    .upsert({
      project_id: projectId,
      user_id: user.id,
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      selected_calendars: selectedCalendars,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,user_id' })

  if (error) {
    console.error('Error saving calendar connection:', error)
    throw error
  }
}

// Get current user's calendar connection for a workspace
export async function getCalendarConnection(
  projectId: string
): Promise<CalendarConnection | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error getting calendar connection:', error)
    return null
  }

  return data
}

// Get all calendar connections for a workspace (for syncing all users' events)
export async function getAllCalendarConnections(
  projectId: string
): Promise<CalendarConnection[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.error('Error getting all calendar connections:', error)
    return []
  }

  return data || []
}

// Update which calendars to sync
export async function updateSelectedCalendars(
  projectId: string,
  calendarIds: string[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('calendar_connections')
    .update({
      selected_calendars: calendarIds,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating selected calendars:', error)
    throw error
  }
}

// Remove calendar connection (disconnect)
export async function removeCalendarConnection(projectId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Delete connection
  const { error: connError } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (connError) {
    console.error('Error removing calendar connection:', connError)
    throw connError
  }

  // Delete user's events
  const { error: eventsError } = await supabase
    .from('calendar_events')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (eventsError) {
    console.error('Error removing calendar events:', eventsError)
    throw eventsError
  }
}

// Sync events: delete old events for user, bulk insert new ones
export async function syncCalendarEventsToDb(
  projectId: string,
  userId: string,
  events: { google_event_id: string; calendar_id: string; summary: string; description?: string; start_time: string; end_time: string; location?: string }[]
): Promise<void> {
  const supabase = createClient()

  // Delete existing events for this user in this project
  const { error: deleteError } = await supabase
    .from('calendar_events')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (deleteError) {
    console.error('Error deleting old calendar events:', deleteError)
    throw deleteError
  }

  if (events.length === 0) return

  // Insert new events
  const rows = events.map(e => ({
    project_id: projectId,
    user_id: userId,
    google_event_id: e.google_event_id,
    calendar_id: e.calendar_id,
    summary: e.summary,
    description: e.description || null,
    start_time: e.start_time,
    end_time: e.end_time,
    location: e.location || null,
    synced_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase
    .from('calendar_events')
    .insert(rows)

  if (insertError) {
    console.error('Error inserting calendar events:', insertError)
    throw insertError
  }
}

// Load shared calendar events for the workspace within a date range
export async function loadSharedCalendarEvents(
  projectId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<DbCalendarEvent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('project_id', projectId)
    .gte('start_time', weekStart.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .order('start_time')

  if (error) {
    console.error('Error loading shared calendar events:', error)
    return []
  }

  return data || []
}
