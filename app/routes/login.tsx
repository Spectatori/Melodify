import { LoaderFunction, redirect } from "@remix-run/node";
import { generateRandomString } from "~/utils/generateRandomString";
import { stringify } from "querystring";

export const loader: LoaderFunction = async () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL!;
  const state = generateRandomString(16);
  const scope = "user-read-private user-read-email";

  // Build the Spotify authorization URL
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?${stringify({
    response_type: "code",
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
  })}`;

  // Redirect the user to Spotify's authorization page
  return redirect(spotifyAuthUrl);
};