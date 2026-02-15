// Google Calendar OAuth and API utilities

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = typeof window !== 'undefined' 
  ? `${window.location.origin}/auth/callback` 
  : '';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

// Start OAuth flow
export function initiateGoogleAuth() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('prompt', 'select_account'); // Force account selection
  
  // Open OAuth popup
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  window.open(
    authUrl.toString(),
    'Google Calendar Authorization',
    `width=${width},height=${height},left=${left},top=${top}`
  );
}

// Store access token
export function storeAccessToken(token: string, expiresIn: number) {
  const expiresAt = Date.now() + (expiresIn * 1000);
  localStorage.setItem('google_access_token', token);
  localStorage.setItem('google_token_expires_at', expiresAt.toString());
}

// Get access token
export function getAccessToken(): string | null {
  const token = localStorage.getItem('google_access_token');
  const expiresAt = localStorage.getItem('google_token_expires_at');
  
  if (!token || !expiresAt) return null;
  
  if (Date.now() > parseInt(expiresAt)) {
    // Token expired
    clearAccessToken();
    return null;
  }
  
  return token;
}

// Clear access token
export function clearAccessToken() {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_expires_at');
}

// Check if connected
export function isGoogleCalendarConnected(): boolean {
  return getAccessToken() !== null;
}

// Fetch calendar events for a date range
export async function fetchCalendarEvents(
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Calendar');
  }

  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
      throw new Error('Authentication expired');
    }
    throw new Error('Failed to fetch calendar events');
  }

  const data = await response.json();
  
  return (data.items || []).map((event: any) => ({
    id: event.id,
    summary: event.summary || 'Untitled Event',
    description: event.description,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    location: event.location,
    attendees: event.attendees?.map((a: any) => a.email) || [],
  }));
}

// Get events grouped by day
export async function getEventsGroupedByDay(
  startDate: Date,
  endDate: Date,
  calendarId?: string
): Promise<Record<string, CalendarEvent[]>> {
  const events = await fetchCalendarEvents(startDate, endDate, calendarId);
  const grouped: Record<string, CalendarEvent[]> = {};

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  events.forEach(event => {
    const eventDate = new Date(event.start);
    const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayName = days[dayOfWeek - 1];
      if (!grouped[dayName]) {
        grouped[dayName] = [];
      }
      grouped[dayName].push(event);
    }
  });

  return grouped;
}
