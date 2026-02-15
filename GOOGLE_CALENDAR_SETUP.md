# Google Calendar Integration Setup

This guide will help you set up Google Calendar OAuth so Machi OS can sync events from `hello@oimachi.co`.

## Prerequisites

- Google account with access to the Oimachi calendar
- Admin access to Google Cloud Console (or ability to create a project)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it "Machi OS" (or any name you prefer)
4. Click **Create**

## Step 2: Enable Google Calendar API

1. In your new project, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in the required fields:
   - **App name**: Machi OS
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **Save and Continue**
5. **Scopes**: Click **Add or Remove Scopes**
   - Search for "Google Calendar API"
   - Select: `.../auth/calendar.readonly` (Read-only access)
   - Click **Update** → **Save and Continue**
6. **Test users**: Add your email (the one with access to hello@oimachi.co)
7. Click **Save and Continue** → **Back to Dashboard**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Name it "Machi OS Web Client"
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3002` (for local development)
   - Your production domain when deployed (e.g., `https://machi.yourapp.com`)
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3002/auth/callback` (for local)
   - Your production callback URL when deployed
7. Click **Create**
8. **Copy the Client ID** (looks like `123456789-abc123.apps.googleusercontent.com`)

## Step 5: Configure Machi OS

1. In your Machi OS project, create a `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your Client ID:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

## Step 6: Connect Your Calendar

1. Open Machi OS in your browser: `http://localhost:3002`
2. Click the **Settings** icon (⚙️) in the top right
3. Under **Integrations**, click **Connect** on Google Calendar
4. Sign in with your Google account
5. Grant permission to read your calendar
6. You should see calendar events from `hello@oimachi.co` appear!

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Make sure you added your email as a test user in the OAuth consent screen
- Check that the redirect URI matches exactly (including http vs https)

### "No events showing"
- Verify you have access to `hello@oimachi.co` calendar
- Check browser console for any errors
- Make sure events exist in the current week (Monday-Friday)

### "Authentication expired"
- Click **Disconnect** in Settings
- Click **Connect** again to re-authenticate

## How It Works

- **Auto-sync**: Events sync every 30 minutes automatically
- **Read-only**: Machi OS only reads your calendar, it cannot create or modify events
- **Current week**: Only shows events for the current work week (Monday-Friday)
- **Calendar**: Specifically fetches from `hello@oimachi.co` calendar

## Security Notes

- Access tokens are stored in browser `localStorage` (client-side only)
- Tokens expire automatically and require re-authentication
- No calendar data is sent to any server - everything stays in your browser
- You can disconnect at any time from Settings

## Production Deployment

When deploying to production:

1. Add your production domain to **Authorized JavaScript origins**
2. Add your production callback URL to **Authorized redirect URIs**
3. Update the `.env` file with your Client ID
4. Consider moving from "Testing" to "Production" in OAuth consent screen (requires Google verification)

## Support

If you encounter issues:
- Check the browser console for errors
- Verify your OAuth credentials are correct
- Make sure the Calendar API is enabled
- Ensure your email has access to the Oimachi calendar
