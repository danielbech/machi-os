// Google Calendar OAuth and API utilities

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/callback`
  : '';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly email';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  calendarId?: string;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string;
}

// Start OAuth flow — authorization code flow (supports refresh tokens)
export function initiateGoogleAuth() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');

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

// Exchange authorization code for tokens via our server route
export async function exchangeAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
}> {
  const response = await fetch('/api/google-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Token exchange failed');
  }

  return response.json();
}

// Refresh an expired access token using a refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch('/api/google-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Token refresh failed');
  }

  return response.json();
}

// Fetch the email of the authenticated Google account
export async function fetchGoogleEmail(token: string): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const data = await response.json();
  return data.email;
}

// Fetch list of user's calendars
export async function fetchCalendarList(token: string): Promise<GoogleCalendarInfo[]> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch calendar list');
  }

  const data = await response.json();
  return (data.items || []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary || cal.id,
    primary: cal.primary || false,
    backgroundColor: cal.backgroundColor || '#4285f4',
  }));
}

// Fetch calendar events for a date range using a provided token
export async function fetchCalendarEvents(
  token: string,
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events');
  url.searchParams.set('timeMin', startDate.toISOString());
  url.searchParams.set('timeMax', endDate.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
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
    calendarId,
  }));
}

// Get events grouped by day (using a provided token, fetching from multiple calendars)
export async function getEventsGroupedByDay(
  token: string,
  startDate: Date,
  endDate: Date,
  calendarIds: string[] = ['primary']
): Promise<{ grouped: Record<string, CalendarEvent[]>; flat: CalendarEvent[] }> {
  // Fetch from all selected calendars in parallel
  const allEvents = await Promise.all(
    calendarIds.map(calId => fetchCalendarEvents(token, startDate, endDate, calId).catch(() => []))
  );
  const events = allEvents.flat();

  const grouped: Record<string, CalendarEvent[]> = {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  events.forEach(event => {
    const eventDate = new Date(event.start);
    const dayOfWeek = eventDate.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayName = days[dayOfWeek - 1];
      if (!grouped[dayName]) {
        grouped[dayName] = [];
      }
      grouped[dayName].push(event);
    }
  });

  return { grouped, flat: events };
}
