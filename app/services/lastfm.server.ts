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
    if (tracks.length < 5) {
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
  const minimumTracks = 5; // Minimum number of tracks we want
  
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
        const new2025Tracks = await searchSpotifyTracks("2025 new music", Math.floor(limit / 2));
        spotifyTracks.push(...new2025Tracks);
        
        console.log(`Found ${new2025Tracks.length} tracks from 2025 search`);
      } catch (error) {
        console.error("Error searching for 2025 music:", error);
      }
      
      // If we have a genre, specifically search for 2025 + genre
      if (genre && spotifyTracks.length < limit) {
        try {
          console.log(`Searching for ${genre} 2025 music`);
          const genreTracks = await searchSpotifyTracks(`${genre} 2025 music new releases`, Math.floor(limit / 2));
          
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
      if (spotifyTracks.length < limit) {
        try {
          console.log("Getting new releases from Spotify");
          const newReleases = await getSpotifyNewReleases(genre, limit);
          
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
      if (spotifyTracks.length < minimumTracks && genre) {
        try {
          console.log(`Getting Spotify genre recommendations for ${genre}`);
          const genreTracks = await getSpotifyGenreRecommendations(genre, limit);
          
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
      if (spotifyTracks.length < minimumTracks && genre) {
        try {
          console.log(`Searching Spotify for ${genre} music`);
          const searchTracks = await searchSpotifyByGenre(genre, limit);
          
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
      if (spotifyTracks.length < minimumTracks) {
        try {
          console.log("Searching Spotify for 2024 new music");
          const searchTracks = await searchSpotifyTracks("2024 new music", limit);
          
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
      
      // Log all tracks that are being returned
      console.log("\n=== LATEST RELEASE TRACKS FROM SPOTIFY ===");
      console.log(`Total tracks: ${contextTracks.length}`);
      console.log(`Genre: ${genre || 'None'}, Subgenre: ${subgenre || 'None'}, Mood: ${mood || 'None'}`);
      contextTracks.forEach((track, index) => {
        console.log(`${index + 1}. "${track.name}" by ${track.artist} - ${track.listeners}`);
      });
      console.log("=================================\n");
      
      // If we still have fewer than 5 tracks, add a note
      if (contextTracks.length < minimumTracks) {
        console.log(`WARNING: Only found ${contextTracks.length} tracks, less than minimum of ${minimumTracks}`);
      }
      
      return contextTracks.slice(0, limit);
    }
    
    // For non-Latest Releases eras, use a combination of Spotify and Last.fm
    let combinedTracks: LastFmContextTrack[] = [];
    
    // 1. Try Spotify first for genre-specific tracks with era filter
    if (genre) {
      try {
        console.log(`Getting Spotify tracks for ${genre} from era ${era || 'any'}`);
        const genreTracks = await getSpotifyGenreRecommendations(genre, limit, era);
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
        const subgenreTracks = await searchSpotifyTracks(searchQuery, Math.floor(limit / 2));
        
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
        const moodTracks = await searchSpotifyTracks(searchQuery, Math.floor(limit / 2));
        
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
        const eraTracks = await searchSpotifyTracks(searchQuery, Math.floor(limit / 2));
        
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
    
    return contextTracks.slice(0, limit);
  } catch (error) {
    console.error("Error building Spotify context:", error);
    // Fall back to some safe default tracks
    return [
      { name: "Blinding Lights", artist: "The Weeknd", listeners: "1000000 (2025 release)", url: "" },
      { name: "Dance The Night", artist: "Dua Lipa", listeners: "950000 (2025 release)", url: "" },
      { name: "As It Was", artist: "Harry Styles", listeners: "980000 (2025 release)", url: "" },
      { name: "Cruel Summer", artist: "Taylor Swift", listeners: "970000 (2025 release)", url: "" },
      { name: "Flowers", artist: "Miley Cyrus", listeners: "960000 (2025 release)", url: "" }
    ];
  }
}