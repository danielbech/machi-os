import { createClient } from './client'

export interface CalendarConnection {
  id: string
  project_id: string
  user_id: string
  access_token: string
  expires_at: string
  selected_calendars: string[]
  google_email: string | null
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
  attendees: string[]
  synced_at: string
  connection_id: string | null
}

// Upsert a calendar connection for a specific Google account
export async function saveCalendarConnection(
  projectId: string,
  accessToken: string,
  expiresAt: Date,
  googleEmail: string,
  selectedCalendars: string[] = ['primary']
): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('calendar_connections')
    .upsert({
      project_id: projectId,
      user_id: user.id,
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      selected_calendars: selectedCalendars,
      google_email: googleEmail,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,user_id,google_email' })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving calendar connection:', error)
    throw error
  }

  return data.id
}

// Get all of the current user's calendar connections for a workspace
export async function getCalendarConnections(
  projectId: string
): Promise<CalendarConnection[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('id, project_id, user_id, access_token, expires_at, selected_calendars, google_email')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('created_at')

  if (error) {
    console.error('Error getting calendar connections:', error)
    return []
  }

  return data || []
}

// Update which calendars to sync for a specific connection
export async function updateSelectedCalendars(
  connectionId: string,
  calendarIds: string[]
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('calendar_connections')
    .update({
      selected_calendars: calendarIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)

  if (error) {
    console.error('Error updating selected calendars:', error)
    throw error
  }
}

// Remove a specific calendar connection (events cascade-delete via connection_id FK)
export async function removeCalendarConnection(connectionId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('id', connectionId)

  if (error) {
    console.error('Error removing calendar connection:', error)
    throw error
  }
}

// Sync events for a specific connection: upsert current events, then remove stale ones
export async function syncCalendarEventsToDb(
  projectId: string,
  userId: string,
  connectionId: string,
  events: { google_event_id: string; calendar_id: string; summary: string; description?: string; start_time: string; end_time: string; location?: string; attendees?: string[] }[]
): Promise<void> {
  const supabase = createClient()
  const now = new Date().toISOString()

  if (events.length === 0) {
    // No events from Google — delete all for this connection
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('connection_id', connectionId)
    if (error) {
      console.error('Error deleting calendar events:', error)
      throw error
    }
    return
  }

  const rows = events.map(e => ({
    project_id: projectId,
    user_id: userId,
    connection_id: connectionId,
    google_event_id: e.google_event_id,
    calendar_id: e.calendar_id,
    summary: e.summary,
    description: e.description || null,
    start_time: e.start_time,
    end_time: e.end_time,
    location: e.location || null,
    attendees: e.attendees || [],
    synced_at: now,
  }))

  // Upsert all current events (update if google_event_id matches)
  const { error: upsertError } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'connection_id,google_event_id' })

  if (upsertError) {
    console.error('Error upserting calendar events:', upsertError)
    throw upsertError
  }

  // Remove stale events (synced before this batch — means they were deleted in Google)
  const { error: cleanupError } = await supabase
    .from('calendar_events')
    .delete()
    .eq('connection_id', connectionId)
    .lt('synced_at', now)

  if (cleanupError) {
    console.error('Error cleaning up stale calendar events:', cleanupError)
    // Non-fatal — events are already upserted, stale ones will be cleaned next sync
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
    .select('id, project_id, user_id, google_event_id, calendar_id, summary, description, start_time, end_time, location, attendees, synced_at, connection_id')
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
