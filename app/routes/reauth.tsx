// Create this file: app/routes/reauth.tsx
import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  
  // Clear existing session
  await sessionStorage.destroySession(session);
  
  // Build Spotify auth URL with explicit scopes and force approval
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.SPOTIFY_CALLBACK_URL || '');
  
  const scopes = [
    'user-read-email',
    'user-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-library-modify',
    'ugc-image-upload'       
  ].join(' ');
  
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${redirectUri}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `show_dialog=true&` +       // This forces Spotify to show the permission dialog again
    `approval_prompt=force`;    // Extra parameter to ensure permission dialog shows
  
  console.log("Redirecting to Spotify with scopes:", scopes);
  
  return redirect(spotifyAuthUrl);
};

export default function Reauth() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary via-pink-400 to-tertiar">
      <div className="text-white text-xl">
        Redirecting to Spotify for re-authentication...
      </div>
    </div>
  );
}