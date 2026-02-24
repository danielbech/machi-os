'use client';

import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    // Parse the hash fragment from OAuth redirect
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    
    if (accessToken && expiresIn && window.opener) {
      // Send token back to parent window
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_SUCCESS',
        accessToken,
        expiresIn: parseInt(expiresIn),
      }, window.location.origin);
      
      // Close popup
      window.close();
    } else if (window.opener) {
      // Auth failed
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_FAILED',
      }, window.location.origin);
      
      window.close();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="mb-4 text-lg">Completing authentication...</div>
        <div className="text-sm text-white/60">This window will close automatically.</div>
      </div>
    </div>
  );
}
