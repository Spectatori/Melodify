import { Authenticator } from 'remix-auth';
import { SpotifyStrategy } from 'remix-auth-spotify';
import { sessionStorage } from '../services/session.server';

function validateEnvironmentVars() {
  const requiredVars = {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_CALLBACK_URL: process.env.SPOTIFY_CALLBACK_URL,
  };

  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) throw new Error(`${key} environment variable is required`);
  });

  return requiredVars as Record<keyof typeof requiredVars, string>;
}

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_CALLBACK_URL } = validateEnvironmentVars();

const spotifyScopes = [
  'user-read-email',
  'user-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
];

const spotifyStrategy = new SpotifyStrategy(
  {
    clientID: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    callbackURL: SPOTIFY_CALLBACK_URL,
    sessionStorage,
    scope: spotifyScopes.join(' '),
  },
  async ({ accessToken, refreshToken, extraParams, profile }) => {
    const expirationTime = Date.now() + (extraParams.expiresIn ?? 3600) * 1000;
    
    return {
      accessToken,
      refreshToken,
      expiresAt: expirationTime,
      tokenType: extraParams.tokenType,
      user: {
        id: profile.id,
        email: profile.emails[0]?.value,
        name: profile.displayName,
        image: profile.__json.images?.[0]?.url,
        country: profile.__json.country,
        product: profile.__json.product,
      },
    };
  }
);

export const authenticator = new Authenticator(sessionStorage);
authenticator.use(spotifyStrategy);

export type SpotifyAuthData = Awaited<ReturnType<typeof spotifyStrategy.authenticate>>;