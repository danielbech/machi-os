'use client';

import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    // Authorization code flow: code comes as a query parameter
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code && window.opener) {
      // Send auth code back to parent window for token exchange
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_CODE',
        code,
      }, window.location.origin);

      window.close();
    } else if (error || !code) {
      // Auth failed or was cancelled
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_FAILED',
        }, window.location.origin);
      }

      window.close();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-4 text-lg">Completing authentication...</div>
        <div className="text-sm text-foreground/60">This window will close automatically.</div>
      </div>
    </div>
  );
}
