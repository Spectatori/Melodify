// app/routes/auth.spotify.tsx (or wherever your Spotify auth route is)
import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const prompt = url.searchParams.get('prompt');
  
  // If prompt=consent, force Spotify to show permission dialog
  if (prompt === 'consent') {
    // Construct the Spotify auth URL with additional parameters
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CALLBACK_URL = process.env.SPOTIFY_CALLBACK_URL;
    
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
    
    const authUrl = `https://accounts.spotify.com/authorize?` +
      `client_id=${SPOTIFY_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(SPOTIFY_CALLBACK_URL!)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `show_dialog=true&` + // Force Spotify to show the authorization dialog
      `prompt=consent`; // Force consent screen
    
    return redirect(authUrl);
  }
  
  // Normal authentication flow
  return authenticator.authenticate('spotify', request, {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
  });
};