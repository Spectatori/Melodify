import { LoaderFunction, redirect } from "@remix-run/node"; // Remix functions
import { generateRandomString } from "~/utils/generateRandomString"; // Random string utility
import { stringify } from "querystring"; // For building query strings

// Load environment variables
const clientId = "4ec23cc7ddf94acfba5e0844bb9f398b"; // Spotify client ID
const redirectUri = "http://localhost:5173/callback"; // Redirect URI

export const loader: LoaderFunction = async () => {
  const state = generateRandomString(16); // Generate a random state string
  const scope = "user-read-private user-read-email"; // Define the scope

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
