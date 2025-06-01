import fetch from "node-fetch";
import { 
  LastFmTrack, 
  LastFmTopTracksResponse, 
  LastFmTagTracksResponse,
  LastFmContextTrack,
  LastFmContextParams
} from "~/types/lastfm.types";
import { LASTFM_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "~/utils/envExports";

// Last.fm API configuration
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";

// Function to get a Spotify access token
async function getSpotifyToken(): Promise<string> {
  try {
    // Verify API credentials exist
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.error("Missing Spotify API credentials in environment variables");
      throw new Error("Spotify API credentials not configured");
    }
    
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`
      },
      body: "grant_type=client_credentials"
    });
    
    if (!response.ok) {
      throw new Error(`Spotify token error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    throw error;
  }
}

// Function to get new releases from Spotify directly
async function getSpotifyNewReleases(genre?: string, limit = 50): Promise<LastFmContextTrack[]> {
  try {
    const token = await getSpotifyToken();
    
    // First, get the new releases
    const newReleasesUrl = `${SPOTIFY_API_URL}/browse/new-releases?limit=${limit}`;
    console.log(`Fetching new releases from: ${newReleasesUrl}`);
    
    const response = await fetch(newReleasesUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Spotify API error: ${response.status} - ${errorText}`);
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    const data = await response.json();
    const albums = data.albums.items;
    
    console.log(`Found ${albums.length} new release albums from Spotify`);
    
    // Collect tracks from these albums
    const tracks: LastFmContextTrack[] = [];
    
    for (const album of albums) {
      // Get tracks from this album
      const tracksResponse = await fetch(`${SPOTIFY_API_URL}/albums/${album.id}/tracks?limit=1`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        
        if (tracksData.items && tracksData.items.length > 0) {
          const track = tracksData.items[0];
          
          // If genre is specified, check the artist's genres
          if (genre) {
            const artistResponse = await fetch(`${SPOTIFY_API_URL}/artists/${album.artists[0].id}`, {
              headers: {
                "Authorization": `Bearer ${token}`
              }
            });
            
            if (artistResponse.ok) {
              const artistData = await artistResponse.json();
              const artistGenres = artistData.genres || [];
              
              // Check if any of the artist's genres match our genre
              const matchesGenre = artistGenres.some((g: string) => 
                g.toLowerCase().includes(genre.toLowerCase()) || 
                genre.toLowerCase().includes(g.toLowerCase())
              );
              
              if (matchesGenre) {
                tracks.push({
                  name: track.name,
                  artist: album.artists[0].name,
                  listeners: album.popularity ? album.popularity.toString() : "New",
                  url: track.external_urls?.spotify || ""
                });
                
                console.log(`✓ Added new ${genre} track: "${track.name}" by ${album.artists[0].name}`);
              }
            }
          } else {
            // No genre filter, add all tracks
            tracks.push({
              name: track.name,
              artist: album.artists[0].name,
              listeners: album.popularity ? album.popularity.toString() : "New",
              url: track.external_urls?.spotify || ""
            });
            
            console.log(`✓ Added new track: "${track.name}" by ${album.artists[0].name}`);
          }
        }
      }
      
      // If we have enough tracks, stop
      if (tracks.length >= limit) {
        break;
      }
    }
    
    console.log(`Returning ${tracks.length} verified new releases from Spotify`);
    return tracks;
  } catch (error) {
    console.error("Error fetching new releases from Spotify:", error);
    return [];
  }
}

// Function to search for tracks on Spotify matching a specific genre
async function searchSpotifyByGenre(genre: string, limit = 50, era?: string): Promise<LastFmContextTrack[]> {
  try {
    const token = await getSpotifyToken();
    
    // Build the query with era if specified
    let searchQuery = genre;
    if (era) {
      const eraQuery = era.replace(/[()]/g, '').trim(); // Remove parentheses
      if (eraQuery !== 'Latest Releases') {
        searchQuery = `${genre} ${eraQuery}`;
      }
    }
    
    // First try to search for genre playlists
    const playlistsUrl = `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(searchQuery)}&type=playlist&limit=5`;
    console.log(`Searching for ${searchQuery} playlists: ${playlistsUrl}`);
    
    const playlistsResponse = await fetch(playlistsUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!playlistsResponse.ok) {
      throw new Error(`Spotify playlists search error: ${playlistsResponse.status}`);
    }
    
    const playlistsData = await playlistsResponse.json();
    
    // Ensure we have playlists data and items before proceeding
    if (!playlistsData?.playlists?.items || playlistsData.playlists.items.length === 0) {
      console.log(`No ${searchQuery} playlists found, trying direct track search`);
      return await searchSpotifyTracks(searchQuery, limit);
    }
    
    const playlists = playlistsData.playlists.items;
    
    // Take the first playlist that seems relevant
    const playlist = playlists[0];
    
    // Check if playlist exists and has required properties
    if (!playlist || !playlist.id || !playlist.name || !playlist.tracks) {
      console.log(`Found invalid playlist data for ${searchQuery}, trying direct track search`);
      return await searchSpotifyTracks(searchQuery, limit);
    }
    
    console.log(`Found playlist: "${playlist.name}" with ${playlist.tracks.total} tracks`);
    
    // Get tracks from this playlist
    const playlistTracksUrl = `${SPOTIFY_API_URL}/playlists/${playlist.id}/tracks?limit=${limit}`;
    const tracksResponse = await fetch(playlistTracksUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!tracksResponse.ok) {
      throw new Error(`Spotify playlist tracks error: ${tracksResponse.status}`);
    }
    
    const tracksData = await tracksResponse.json();
    
    // Make sure we have items in the response
    if (!tracksData || !tracksData.items || !Array.isArray(tracksData.items)) {
      console.log(`No valid tracks found in playlist for ${searchQuery}, trying direct track search`);
      return await searchSpotifyTracks(searchQuery, limit);
    }
    
    const trackItems = tracksData.items;
    
    // Extract track info with validation for each property
    const tracks: LastFmContextTrack[] = trackItems
      .filter((item: any) => item && item.track && item.track.name && item.track.artists && item.track.artists.length > 0) 
      .map((item: any) => ({
        name: item.track.name,
        artist: item.track.artists[0].name,
        listeners: item.track.popularity ? item.track.popularity.toString() : "Unknown",
        url: item.track.external_urls?.spotify || ""
      }));
    
    console.log(`Extracted ${tracks.length} tracks from ${searchQuery} playlist`);
    
    // If we didn't find enough tracks, try direct search
    if (tracks.length < 25) {
      console.log(`Only found ${tracks.length} valid tracks in playlist, supplementing with direct search`);
      const additionalTracks = await searchSpotifyTracks(searchQuery, limit - tracks.length);
      return [...tracks, ...additionalTracks];
    }
    
    return tracks;
  } catch (error) {
    console.error(`Error searching Spotify for ${genre} playlists:`, error);
    // Fall back to direct track search
    return await searchSpotifyTracks(genre, limit);
  }
}

// Function to directly search Spotify for tracks
async function searchSpotifyTracks(query: string, limit = 50): Promise<LastFmContextTrack[]> {
  try {
    const token = await getSpotifyToken();
    
    // Search for tracks
    const url = `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
    console.log(`Searching Spotify tracks: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Spotify search error: ${response.status}`);
    }
    
    const data = await response.json();
    const tracks = data.tracks.items;
    
    console.log(`Found ${tracks.length} tracks for query "${query}"`);
    
    // Convert to our format
    const formattedTracks: LastFmContextTrack[] = tracks.map((track: any) => ({
      name: track.name,
      artist: track.artists[0].name,
      listeners: track.popularity ? track.popularity.toString() : "Unknown",
      url: track.external_urls?.spotify || ""
    }));
    
    return formattedTracks;
  } catch (error) {
    console.error(`Error searching Spotify tracks for ${query}:`, error);
    return [];
  }
}

// Function to get tracks for a specific genre from Spotify's genre-based recommendations
async function getSpotifyGenreRecommendations(genre: string, limit = 50, era?: string): Promise<LastFmContextTrack[]> {
  try {
    const token = await getSpotifyToken();
    
    // Skip the genre seeds API check and go directly to search - it's more reliable
    console.log(`Bypassing genre recommendations for "${genre}" and using direct search instead`);
    return await searchSpotifyByGenre(genre, limit, era);
    
  } catch (error) {
    console.error(`Error getting Spotify recommendations for ${genre}:`, error);
    // Fallback to direct search
    return await searchSpotifyByGenre(genre, limit, era);
  }
}

// Enhanced fallback function to get tracks from multiple sources
async function getEnhancedFallbackTracks(
  params: LastFmContextParams, 
  currentTracks: LastFmContextTrack[], 
  targetCount: number
): Promise<LastFmContextTrack[]> {
  const { genre, subgenre, mood, era } = params;
  let additionalTracks: LastFmContextTrack[] = [];
  
  console.log(`Getting enhanced fallback tracks. Current: ${currentTracks.length}, Target: ${targetCount}`);
  
  // Strategy 1: Broader genre search
  if (genre && additionalTracks.length < (targetCount - currentTracks.length)) {
    try {
      console.log(`Fallback 1: Broader search for "${genre}"`);
      const broaderTracks = await searchSpotifyTracks(`${genre} music`, 30);
      
      // Filter out duplicates
      const existingKeys = new Set([...currentTracks, ...additionalTracks].map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const uniqueTracks = broaderTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingKeys.has(key);
      });
      
      additionalTracks.push(...uniqueTracks);
      console.log(`Fallback 1: Added ${uniqueTracks.length} tracks`);
    } catch (error) {
      console.error("Fallback 1 failed:", error);
    }
  }
  
  // Strategy 2: Popular songs from era
  if (era && era !== 'Latest Releases' && additionalTracks.length < (targetCount - currentTracks.length)) {
    try {
      console.log(`Fallback 2: Popular songs from ${era}`);
      const eraQuery = era.replace(/[()]/g, '').trim();
      const eraTracks = await searchSpotifyTracks(`${eraQuery} hits`, 30);
      
      const existingKeys = new Set([...currentTracks, ...additionalTracks].map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const uniqueTracks = eraTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingKeys.has(key);
      });
      
      additionalTracks.push(...uniqueTracks);
      console.log(`Fallback 2: Added ${uniqueTracks.length} tracks`);
    } catch (error) {
      console.error("Fallback 2 failed:", error);
    }
  }
  
  // Strategy 3: Mood-based search
  if (mood && additionalTracks.length < (targetCount - currentTracks.length)) {
    try {
      console.log(`Fallback 3: Mood-based search for "${mood}"`);
      const moodTracks = await searchSpotifyTracks(`${mood} songs`, 30);
      
      const existingKeys = new Set([...currentTracks, ...additionalTracks].map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const uniqueTracks = moodTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingKeys.has(key);
      });
      
      additionalTracks.push(...uniqueTracks);
      console.log(`Fallback 3: Added ${uniqueTracks.length} tracks`);
    } catch (error) {
      console.error("Fallback 3 failed:", error);
    }
  }
  
  // Strategy 4: Generic popular tracks
  if (additionalTracks.length < (targetCount - currentTracks.length)) {
    try {
      console.log("Fallback 4: Generic popular tracks");
      const popularTracks = await searchSpotifyTracks("top hits 2024", 50);
      
      const existingKeys = new Set([...currentTracks, ...additionalTracks].map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const uniqueTracks = popularTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingKeys.has(key);
      });
      
      additionalTracks.push(...uniqueTracks);
      console.log(`Fallback 4: Added ${uniqueTracks.length} tracks`);
    } catch (error) {
      console.error("Fallback 4 failed:", error);
    }
  }
  
  // Strategy 5: Last resort - curated list
  if (additionalTracks.length < (targetCount - currentTracks.length)) {
    console.log("Fallback 5: Last resort curated tracks");
    
    const curatedTracks: LastFmContextTrack[] = [
      { name: "Blinding Lights", artist: "The Weeknd", listeners: "Popular", url: "" },
      { name: "Shape of You", artist: "Ed Sheeran", listeners: "Popular", url: "" },
      { name: "Dance The Night", artist: "Dua Lipa", listeners: "Popular", url: "" },
      { name: "As It Was", artist: "Harry Styles", listeners: "Popular", url: "" },
      { name: "Anti-Hero", artist: "Taylor Swift", listeners: "Popular", url: "" },
      { name: "Flowers", artist: "Miley Cyrus", listeners: "Popular", url: "" },
      { name: "Unholy", artist: "Sam Smith ft. Kim Petras", listeners: "Popular", url: "" },
      { name: "Heat Waves", artist: "Glass Animals", listeners: "Popular", url: "" },
      { name: "Stay", artist: "The Kid LAROI & Justin Bieber", listeners: "Popular", url: "" },
      { name: "Good 4 U", artist: "Olivia Rodrigo", listeners: "Popular", url: "" },
      { name: "Levitating", artist: "Dua Lipa", listeners: "Popular", url: "" },
      { name: "Watermelon Sugar", artist: "Harry Styles", listeners: "Popular", url: "" },
      { name: "Therefore I Am", artist: "Billie Eilish", listeners: "Popular", url: "" },
      { name: "positions", artist: "Ariana Grande", listeners: "Popular", url: "" },
      { name: "34+35", artist: "Ariana Grande", listeners: "Popular", url: "" },
      { name: "Mood", artist: "24kGoldn ft. iann dior", listeners: "Popular", url: "" },
      { name: "Rockstar", artist: "DaBaby ft. Roddy Ricch", listeners: "Popular", url: "" },
      { name: "The Box", artist: "Roddy Ricch", listeners: "Popular", url: "" },
      { name: "Circles", artist: "Post Malone", listeners: "Popular", url: "" },
      { name: "Don't Start Now", artist: "Dua Lipa", listeners: "Popular", url: "" },
      { name: "Savage", artist: "Megan Thee Stallion", listeners: "Popular", url: "" },
      { name: "Rain on Me", artist: "Lady Gaga & Ariana Grande", listeners: "Popular", url: "" },
      { name: "Stuck with U", artist: "Ariana Grande & Justin Bieber", listeners: "Popular", url: "" },
      { name: "Say So", artist: "Doja Cat", listeners: "Popular", url: "" },
      { name: "Toosie Slide", artist: "Drake", listeners: "Popular", url: "" },
      { name: "Someone You Loved", artist: "Lewis Capaldi", listeners: "Popular", url: "" },
      { name: "Bad Guy", artist: "Billie Eilish", listeners: "Popular", url: "" },
      { name: "Old Town Road", artist: "Lil Nas X ft. Billy Ray Cyrus", listeners: "Popular", url: "" },
      { name: "Sunflower", artist: "Post Malone & Swae Lee", listeners: "Popular", url: "" },
      { name: "Without Me", artist: "Halsey", listeners: "Popular", url: "" },
      { name: "7 rings", artist: "Ariana Grande", listeners: "Popular", url: "" },
      { name: "Sucker", artist: "Jonas Brothers", listeners: "Popular", url: "" },
      { name: "Truth Hurts", artist: "Lizzo", listeners: "Popular", url: "" },
      { name: "Senorita", artist: "Shawn Mendes & Camila Cabello", listeners: "Popular", url: "" },
      { name: "I Don't Care", artist: "Ed Sheeran & Justin Bieber", listeners: "Popular", url: "" },
      { name: "Memories", artist: "Maroon 5", listeners: "Popular", url: "" },
      { name: "Lose You To Love Me", artist: "Selena Gomez", listeners: "Popular", url: "" },
      { name: "Circles", artist: "Mac Miller", listeners: "Popular", url: "" },
      { name: "10,000 Hours", artist: "Dan + Shay & Justin Bieber", listeners: "Popular", url: "" },
      { name: "Roxanne", artist: "Arizona Zervas", listeners: "Popular", url: "" }
    ];
    
    const existingKeys = new Set([...currentTracks, ...additionalTracks].map(t => `${t.name}-${t.artist}`.toLowerCase()));
    const uniqueCuratedTracks = curatedTracks.filter(track => {
      const key = `${track.name}-${track.artist}`.toLowerCase();
      return !existingKeys.has(key);
    });
    
    additionalTracks.push(...uniqueCuratedTracks);
    console.log(`Fallback 5: Added ${uniqueCuratedTracks.length} curated tracks`);
  }
  
  console.log(`Enhanced fallback complete. Added ${additionalTracks.length} additional tracks`);
  return additionalTracks;
}

// Function to fetch recent top tracks from Last.fm (kept as a fallback)
export async function fetchTopTracks(params: {
  limit?: number;
  page?: number;
  genre?: string;
}): Promise<LastFmTrack[]> {
  const { limit = 50, page = 1, genre } = params;
  
  try {
    // Check if Last.fm API key exists
    if (!LASTFM_API_KEY) {
      console.error("Missing Last.fm API key in environment variables");
      return [];
    }
    
    // Use tag parameter for genre if provided
    const tagParam = genre ? `&tag=${encodeURIComponent(genre)}` : '';
    
    const response = await fetch(
      `${LASTFM_API_URL}?method=chart.gettoptracks&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}&page=${page}${tagParam}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Last.fm API error response for top tracks: ${response.status} - ${errorText}`);
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    
    const data = await response.json() as LastFmTopTracksResponse;
    return data.tracks.track;
  } catch (error) {
    console.error("Error fetching Last.fm top tracks:", error);
    // Return empty array instead of throwing to make the function more resilient
    return [];
  }
}

// Function to fetch tracks by tag (genre/mood) from Last.fm (kept as a fallback)
export async function fetchTracksByTag(tag: string, limit = 50): Promise<LastFmTrack[]> {
  try {
    // Check if Last.fm API key exists
    if (!LASTFM_API_KEY) {
      console.error("Missing Last.fm API key in environment variables");
      return [];
    }
    
    // Add URL parameters correctly
    const url = `${LASTFM_API_URL}?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;
    
    console.log(`Fetching Last.fm tracks for tag: ${tag} using URL: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Last.fm API error response for tag ${tag}: ${response.status} - ${errorText}`);
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    
    const data = await response.json() as LastFmTagTracksResponse;
    
    // Check if the response contains the expected structure
    if (!data.tracks || !Array.isArray(data.tracks.track)) {
      console.warn(`Unexpected response structure for tag ${tag}:`, JSON.stringify(data).substring(0, 200));
      return [];
    }
    
    console.log(`Successfully fetched ${data.tracks.track.length} tracks for tag ${tag}`);
    return data.tracks.track;
  } catch (error) {
    console.error(`Error fetching Last.fm tracks by tag ${tag}:`, error);
    // Return empty array instead of throwing to make the function more resilient
    return [];
  }
}

// Function to build a Last.fm context database for Llama
export async function buildLastFmContext(params: LastFmContextParams): Promise<LastFmContextTrack[]> {
  const { genre, subgenre, mood, era, limit = 50 } = params;
  const targetTracks = Math.max(limit, 30); // Ensure we aim for at least 30 tracks
  
  try {
    // Collect tracks from multiple sources based on parameters
    let contextTracks: LastFmContextTrack[] = [];
    
    // Handle Latest Releases specially - ONLY use Spotify for Latest Releases
    if (era === 'Latest Releases') {
      console.log("Fetching Latest Releases using Spotify");
      
      // Strategy: Use Spotify directly for all Latest Releases queries
      let spotifyTracks: LastFmContextTrack[] = [];
      
      // First, explicitly search for 2025 music
      try {
        console.log("Searching Spotify for 2025 music explicitly");
        const new2025Tracks = await searchSpotifyTracks("2025 new music", Math.floor(targetTracks / 2));
        spotifyTracks.push(...new2025Tracks);
        
        console.log(`Found ${new2025Tracks.length} tracks from 2025 search`);
      } catch (error) {
        console.error("Error searching for 2025 music:", error);
      }
      
      // If we have a genre, specifically search for 2025 + genre
      if (genre && spotifyTracks.length < targetTracks) {
        try {
          console.log(`Searching for ${genre} 2025 music`);
          const genreTracks = await searchSpotifyTracks(`${genre} 2025 music new releases`, Math.floor(targetTracks / 2));
          
          // Avoid duplicates
          const existingTrackIds = new Set(spotifyTracks.map(t => `${t.name}-${t.artist}`));
          const newTracks = genreTracks.filter(track => 
            !existingTrackIds.has(`${track.name}-${track.artist}`)
          );
          
          spotifyTracks.push(...newTracks);
          console.log(`Added ${newTracks.length} tracks from ${genre} 2025 search`);
        } catch (error) {
          console.error(`Error searching for ${genre} 2025 music:`, error);
        }
      }
      
      // 1. Also try to get Spotify's new releases
      if (spotifyTracks.length < targetTracks) {
        try {
          console.log("Getting new releases from Spotify");
          const newReleases = await getSpotifyNewReleases(genre, targetTracks);
          
          // Avoid duplicates
          const existingTrackIds = new Set(spotifyTracks.map(t => `${t.name}-${t.artist}`));
          const newTracks = newReleases.filter(track => 
            !existingTrackIds.has(`${track.name}-${track.artist}`)
          );
          
          spotifyTracks.push(...newTracks);
          console.log(`Added ${newTracks.length} tracks from new releases`);
        } catch (error) {
          console.error("Error getting Spotify new releases:", error);
        }
      }
      
      // 2. If we still need more tracks and have a genre, get genre-specific recommendations
      if (spotifyTracks.length < Math.floor(targetTracks * 0.7) && genre) {
        try {
          console.log(`Getting Spotify genre recommendations for ${genre}`);
          const genreTracks = await getSpotifyGenreRecommendations(genre, targetTracks);
          
          // Avoid duplicates
          const existingTrackIds = new Set(spotifyTracks.map(t => `${t.name}-${t.artist}`));
          const newTracks = genreTracks.filter(track => 
            !existingTrackIds.has(`${track.name}-${track.artist}`)
          );
          
          spotifyTracks.push(...newTracks);
          console.log(`Added ${newTracks.length} tracks from genre recommendations`);
        } catch (error) {
          console.error(`Error getting Spotify genre recommendations for ${genre}:`, error);
        }
      }
      
      // 3. If we still need more tracks and have a genre, search for that genre
      if (spotifyTracks.length < Math.floor(targetTracks * 0.7) && genre) {
        try {
          console.log(`Searching Spotify for ${genre} music`);
          const searchTracks = await searchSpotifyByGenre(genre, targetTracks);
          
          // Avoid duplicates
          const existingTrackIds = new Set(spotifyTracks.map(t => `${t.name}-${t.artist}`));
          const newTracks = searchTracks.filter(track => 
            !existingTrackIds.has(`${track.name}-${track.artist}`)
          );
          
          spotifyTracks.push(...newTracks);
          console.log(`Added ${newTracks.length} tracks from genre search`);
        } catch (error) {
          console.error(`Error searching Spotify for ${genre}:`, error);
        }
      }
      
      // 4. Also search for "new music 2024" as a fallback
      if (spotifyTracks.length < Math.floor(targetTracks * 0.7)) {
        try {
          console.log("Searching Spotify for 2024 new music");
          const searchTracks = await searchSpotifyTracks("2024 new music", targetTracks);
          
          // Avoid duplicates
          const existingTrackIds = new Set(spotifyTracks.map(t => `${t.name}-${t.artist}`));
          const newTracks = searchTracks.filter(track => 
            !existingTrackIds.has(`${track.name}-${track.artist}`)
          );
          
          spotifyTracks.push(...newTracks);
          console.log(`Added ${newTracks.length} tracks from 2024 search`);
        } catch (error) {
          console.error("Error searching Spotify for 2024 music:", error);
        }
      }
      
      // Add all the tracks we found from Spotify
      contextTracks.push(...spotifyTracks);
      
      // Add metadata to track names to flag new releases, but not in a way that the LLM will append to all songs
      contextTracks = contextTracks.map(track => {
        return {
          ...track,
          // Add a note at the end of listeners instead of altering the song name
          listeners: track.listeners + " (2025 release)"
        };
      });
      
      // Enhanced fallback for Latest Releases if we don't have enough
      if (contextTracks.length < targetTracks) {
        console.log(`Latest Releases: Only ${contextTracks.length} tracks, getting enhanced fallback`);
        const additionalTracks = await getEnhancedFallbackTracks(params, contextTracks, targetTracks);
        
        // Mark additional tracks as recent releases too
        const markedAdditionalTracks = additionalTracks.map(track => ({
          ...track,
          listeners: track.listeners + " (2024-2025 era)"
        }));
        
        contextTracks.push(...markedAdditionalTracks);
      }
      
      // Log all tracks that are being returned
      console.log("\n=== LATEST RELEASE TRACKS FROM SPOTIFY ===");
      console.log(`Total tracks: ${contextTracks.length}`);
      console.log(`Genre: ${genre || 'None'}, Subgenre: ${subgenre || 'None'}, Mood: ${mood || 'None'}`);
      contextTracks.forEach((track, index) => {
        console.log(`${index + 1}. "${track.name}" by ${track.artist} - ${track.listeners}`);
      });
      console.log("=================================\n");
      
      return contextTracks.slice(0, targetTracks);
    }
    
    // For non-Latest Releases eras, use a combination of Spotify and Last.fm
    let combinedTracks: LastFmContextTrack[] = [];
    
    // 1. Try Spotify first for genre-specific tracks with era filter
    if (genre) {
      try {
        console.log(`Getting Spotify tracks for ${genre} from era ${era || 'any'}`);
        const genreTracks = await getSpotifyGenreRecommendations(genre, targetTracks, era);
        combinedTracks.push(...genreTracks);
      } catch (error) {
        console.error(`Error getting Spotify tracks for ${genre}:`, error);
      }
    }
    
    // 2. If we have subgenre or mood, search for those too with era filter
    if (subgenre) {
      try {
        // Include era in the search query if available
        let searchQuery = subgenre;
        if (era) {
          const eraQuery = era.replace(/[()]/g, '').trim(); // Remove parentheses
          if (eraQuery !== 'Latest Releases') {
            searchQuery = `${subgenre} ${eraQuery}`;
          }
        }
        
        console.log(`Searching Spotify for ${searchQuery}`);
        const subgenreTracks = await searchSpotifyTracks(searchQuery, Math.floor(targetTracks / 2));
        
        // Avoid duplicates
        const existingTrackIds = new Set(combinedTracks.map(t => `${t.name}-${t.artist}`));
        const newTracks = subgenreTracks.filter(track => 
          !existingTrackIds.has(`${track.name}-${track.artist}`)
        );
        
        combinedTracks.push(...newTracks);
      } catch (error) {
        console.error(`Error searching Spotify for ${subgenre}:`, error);
      }
    }
    
    if (mood) {
      try {
        // Include era in the search query if available
        let searchQuery = `${mood} music`;
        if (era) {
          const eraQuery = era.replace(/[()]/g, '').trim(); // Remove parentheses
          if (eraQuery !== 'Latest Releases') {
            searchQuery = `${mood} music ${eraQuery}`;
          }
        }
        
        console.log(`Searching Spotify for ${searchQuery}`);
        const moodTracks = await searchSpotifyTracks(searchQuery, Math.floor(targetTracks / 2));
        
        // Avoid duplicates
        const existingTrackIds = new Set(combinedTracks.map(t => `${t.name}-${t.artist}`));
        const newTracks = moodTracks.filter(track => 
          !existingTrackIds.has(`${track.name}-${track.artist}`)
        );
        
        combinedTracks.push(...newTracks);
      } catch (error) {
        console.error(`Error searching Spotify for ${mood} music:`, error);
      }
    }
    
    // 3. Add era-specific search if available
    if (era) {
      const eraQuery = era.replace(/[()]/g, '').trim(); // Remove parentheses
      
      try {
        let searchQuery = `${eraQuery} music`;
        if (genre) {
          searchQuery = `${genre} ${eraQuery} music`;
        }
        
        console.log(`Searching Spotify for ${searchQuery}`);
        const eraTracks = await searchSpotifyTracks(searchQuery, Math.floor(targetTracks / 2));
        
        // Avoid duplicates
        const existingTrackIds = new Set(combinedTracks.map(t => `${t.name}-${t.artist}`));
        const newTracks = eraTracks.filter(track => 
          !existingTrackIds.has(`${track.name}-${track.artist}`)
        );
        
        combinedTracks.push(...newTracks);
      } catch (error) {
        console.error(`Error searching Spotify for ${eraQuery} music:`, error);
      }
    }
    
    // Add all the tracks we found
    contextTracks.push(...combinedTracks);
    
    // Enhanced fallback if we don't have enough tracks
    if (contextTracks.length < targetTracks) {
      console.log(`Only ${contextTracks.length} tracks found, getting enhanced fallback to reach ${targetTracks}`);
      const additionalTracks = await getEnhancedFallbackTracks(params, contextTracks, targetTracks);
      contextTracks.push(...additionalTracks);
    }
    
    // Add era info to listener metadata
    if (era && era !== 'Latest Releases') {
      contextTracks = contextTracks.map(track => {
        return {
          ...track,
          listeners: track.listeners + ` (${era} era)`
        };
      });
    }
    
    // Log all tracks that are being returned
    console.log(`\n=== TRACKS FOR ${era || 'NO ERA'} ===`);
    console.log(`Total tracks: ${contextTracks.length}`);
    console.log(`Genre: ${genre || 'None'}, Subgenre: ${subgenre || 'None'}, Mood: ${mood || 'None'}`);
    contextTracks.forEach((track, index) => {
      console.log(`${index + 1}. "${track.name}" by ${track.artist} - ${track.listeners}`);
    });
    console.log("=================================\n");
    
    return contextTracks.slice(0, targetTracks);
  } catch (error) {
    console.error("Error building Spotify context:", error);
    
    // Last resort fallback to curated tracks
    console.log("Using last resort curated tracks");
    const fallbackTracks: LastFmContextTrack[] = [
      { name: "Blinding Lights", artist: "The Weeknd", listeners: "1000000 (Popular)", url: "" },
      { name: "Dance The Night", artist: "Dua Lipa", listeners: "950000 (Popular)", url: "" },
      { name: "As It Was", artist: "Harry Styles", listeners: "980000 (Popular)", url: "" },
      { name: "Anti-Hero", artist: "Taylor Swift", listeners: "970000 (Popular)", url: "" },
      { name: "Flowers", artist: "Miley Cyrus", listeners: "960000 (Popular)", url: "" },
      { name: "Shape of You", artist: "Ed Sheeran", listeners: "955000 (Popular)", url: "" },
      { name: "Bad Guy", artist: "Billie Eilish", listeners: "945000 (Popular)", url: "" },
      { name: "Watermelon Sugar", artist: "Harry Styles", listeners: "940000 (Popular)", url: "" },
      { name: "Levitating", artist: "Dua Lipa", listeners: "935000 (Popular)", url: "" },
      { name: "Good 4 U", artist: "Olivia Rodrigo", listeners: "930000 (Popular)", url: "" },
      { name: "Stay", artist: "The Kid LAROI & Justin Bieber", listeners: "925000 (Popular)", url: "" },
      { name: "Heat Waves", artist: "Glass Animals", listeners: "920000 (Popular)", url: "" },
      { name: "Industry Baby", artist: "Lil Nas X & Jack Harlow", listeners: "915000 (Popular)", url: "" },
      { name: "Peaches", artist: "Justin Bieber", listeners: "910000 (Popular)", url: "" },
      { name: "Save Your Tears", artist: "The Weeknd", listeners: "905000 (Popular)", url: "" },
      { name: "Montero", artist: "Lil Nas X", listeners: "900000 (Popular)", url: "" },
      { name: "drivers license", artist: "Olivia Rodrigo", listeners: "895000 (Popular)", url: "" },
      { name: "Positions", artist: "Ariana Grande", listeners: "890000 (Popular)", url: "" },
      { name: "Mood", artist: "24kGoldn ft. iann dior", listeners: "885000 (Popular)", url: "" },
      { name: "Willow", artist: "Taylor Swift", listeners: "880000 (Popular)", url: "" }
    ];
    
    return fallbackTracks.slice(0, Math.min(targetTracks, fallbackTracks.length));
  }
}