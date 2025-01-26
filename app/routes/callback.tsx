import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return redirect('/login');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL!;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    // Fetch user profile
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const profile = await profileResponse.json();

    // Create session
    const session = await sessionStorage.getSession(request.headers.get('Cookie'));
    session.set('user', {
      id: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      profileImage: profile.images?.[0]?.url,
      accessToken: tokenData.access_token
    });

    // Commit session and redirect
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': await sessionStorage.commitSession(session)
      }
    });

  } catch (error) {
    console.error('Spotify authentication error:', error);
    return redirect('/login');
  }
};