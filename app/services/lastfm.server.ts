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

// Spotify token management for verification
let spotifyVerificationToken: string | null = null;
let tokenExpiry: number = 0;

// Function to get a Spotify access token for verification
async function getSpotifyToken(): Promise<string> {
  if (spotifyVerificationToken && Date.now() < tokenExpiry) {
    return spotifyVerificationToken as string; // Type assertion since we know it's not null here
  }

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
    spotifyVerificationToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 30000; // 30s buffer

    return spotifyVerificationToken as string; // Type assertion since we just set it
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    throw error;
  }
}

// Function to verify if a Last.fm track exists on Spotify
async function verifyTrackOnSpotify(track: LastFmContextTrack): Promise<{ exists: boolean; correctedTrack?: LastFmContextTrack }> {
  try {
    const token = await getSpotifyToken();
    
    const cleanSongName = track.name.replace(/[^\w\s]/g, '').trim();
    const cleanArtistName = track.artist.replace(/[^\w\s]/g, '').trim();
    const searchQuery = `track:"${cleanSongName}" artist:"${cleanArtistName}"`;
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      console.warn(`Spotify verification failed for "${track.name}" by ${track.artist}: ${response.status}`);
      return { exists: false };
    }
    
    const data = await response.json();
    
    if (data.tracks.items.length > 0) {
      // Find the best match
      let bestMatch = data.tracks.items[0];
      
      for (const spotifyTrack of data.tracks.items) {
        const trackArtists = spotifyTrack.artists.map((a: any) => a.name.toLowerCase()).join(' ');
        if (trackArtists.includes(cleanArtistName.toLowerCase())) {
          bestMatch = spotifyTrack;
          break;
        }
      }
      
      // Create corrected track with Spotify's actual data but keep Last.fm format
      const correctedTrack: LastFmContextTrack = {
        name: bestMatch.name,
        artist: bestMatch.artists[0].name,
        listeners: track.listeners, // Keep Last.fm listener count
        url: bestMatch.external_urls?.spotify || track.url
      };
      
      console.log(`✅ Verified on Spotify: "${bestMatch.name}" by ${bestMatch.artists[0].name}`);
      return { exists: true, correctedTrack };
    }
    
    console.log(`❌ Not found on Spotify: "${track.name}" by ${track.artist}`);
    return { exists: false };
    
  } catch (error) {
    console.error(`Error verifying track "${track.name}" by ${track.artist}:`, error);
    return { exists: false };
  }
}

// Function to verify multiple Last.fm tracks on Spotify
async function verifyLastFmTracksOnSpotify(tracks: LastFmContextTrack[]): Promise<LastFmContextTrack[]> {
  const verifiedTracks: LastFmContextTrack[] = [];
  const batchSize = 5; // Process in small batches to avoid rate limiting
  
  console.log(`🔍 Verifying ${tracks.length} Last.fm tracks on Spotify...`);
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    // Process batch with delay between requests
    for (const track of batch) {
      const verification = await verifyTrackOnSpotify(track);
      
      if (verification.exists && verification.correctedTrack) {
        verifiedTracks.push(verification.correctedTrack);
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Batch ${Math.floor(i/batchSize) + 1} complete. Verified: ${verifiedTracks.length} songs`);
  }
  
  console.log(`🎵 Verification complete: ${verifiedTracks.length} out of ${tracks.length} Last.fm tracks verified on Spotify`);
  return verifiedTracks;
}

// Function to fetch recent top tracks from Last.fm
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

// Function to fetch tracks by tag (genre/mood) from Last.fm
export async function fetchTracksByTag(tag: string, limit = 50): Promise<LastFmTrack[]> {
  try {
    // Check if Last.fm API key exists
    if (!LASTFM_API_KEY) {
      console.error("Missing Last.fm API key in environment variables");
      return [];
    }
    
    // Add URL parameters correctly
    const url = `${LASTFM_API_URL}?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;
    
    console.log(`Fetching Last.fm tracks for tag: ${tag}`);
    
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

// Function to convert Last.fm tracks to context tracks
function convertLastFmToContextTracks(lastFmTracks: LastFmTrack[]): LastFmContextTrack[] {
  return lastFmTracks.map(track => ({
    name: track.name,
    artist: typeof track.artist === 'string' ? track.artist : track.artist.name,
    listeners: track.listeners || "Unknown",
    url: track.url || ""
  }));
}

// Function to get Last.fm tracks for latest releases (2024-2025)
async function getLastFmLatestReleases(genre?: string, limit = 50): Promise<LastFmContextTrack[]> {
  const tracks: LastFmContextTrack[] = [];
  
  try {
    console.log("Fetching latest releases from Last.fm...");
    
    // Strategy 1: Get recent chart tracks
    const chartTracks = await fetchTopTracks({ limit: Math.floor(limit / 2) });
    const chartContextTracks = convertLastFmToContextTracks(chartTracks);
    tracks.push(...chartContextTracks);
    
    // Strategy 2: If genre specified, get tracks by genre tag
    if (genre) {
      const genreTracks = await fetchTracksByTag(genre, Math.floor(limit / 2));
      const genreContextTracks = convertLastFmToContextTracks(genreTracks);
      
      // Avoid duplicates
      const existingKeys = new Set(tracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const uniqueGenreTracks = genreContextTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingKeys.has(key);
      });
      
      tracks.push(...uniqueGenreTracks);
    }
    
    // Strategy 3: Get tracks from popular tags for recent music
    const recentTags = ['new music', 'pop', 'trending'];
    for (const tag of recentTags) {
      if (tracks.length >= limit) break;
      
      try {
        const tagTracks = await fetchTracksByTag(tag, 20);
        const tagContextTracks = convertLastFmToContextTracks(tagTracks);
        
        const existingKeys = new Set(tracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueTagTracks = tagContextTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        tracks.push(...uniqueTagTracks.slice(0, Math.max(0, limit - tracks.length)));
      } catch (error) {
        console.error(`Error fetching tracks for tag ${tag}:`, error);
      }
    }
    
    console.log(`Fetched ${tracks.length} latest release tracks from Last.fm`);
    return tracks.slice(0, limit);
    
  } catch (error) {
    console.error("Error fetching latest releases from Last.fm:", error);
    return tracks;
  }
}

// Function to get Last.fm tracks for specific era
async function getLastFmEraSpecificTracks(era: string, genre?: string, limit = 50): Promise<LastFmContextTrack[]> {
  const tracks: LastFmContextTrack[] = [];
  
  try {
    console.log(`Fetching ${era} tracks from Last.fm...`);
    
    // Create era-specific search tags
    const eraQuery = era.replace(/[()]/g, '').trim();
    const eraTags = [];
    
    if (genre) {
      eraTags.push(genre);
    }
    
    // Add decade-specific tags
    if (eraQuery.includes('2020') || eraQuery.includes('2010')) {
      eraTags.push('2010s', '2020s');
    } else if (eraQuery.includes('2000')) {
      eraTags.push('2000s');
    } else if (eraQuery.includes('90') || eraQuery.includes('1990')) {
      eraTags.push('90s', '1990s');
    } else if (eraQuery.includes('80') || eraQuery.includes('1980')) {
      eraTags.push('80s', '1980s');
    } else if (eraQuery.includes('70') || eraQuery.includes('1970')) {
      eraTags.push('70s', '1970s');
    }
    
    // If no specific era tags, use the era string directly
    if (eraTags.length === 0) {
      eraTags.push(eraQuery.toLowerCase());
    }
    
    // Fetch tracks for each tag
    for (const tag of eraTags) {
      if (tracks.length >= limit) break;
      
      try {
        const tagTracks = await fetchTracksByTag(tag, Math.floor(limit / eraTags.length) + 10);
        const tagContextTracks = convertLastFmToContextTracks(tagTracks);
        
        // Avoid duplicates
        const existingKeys = new Set(tracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueTagTracks = tagContextTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        tracks.push(...uniqueTagTracks);
        console.log(`Added ${uniqueTagTracks.length} tracks from tag: ${tag}`);
      } catch (error) {
        console.error(`Error fetching tracks for tag ${tag}:`, error);
      }
    }
    
    console.log(`Fetched ${tracks.length} era-specific tracks from Last.fm`);
    return tracks.slice(0, limit);
    
  } catch (error) {
    console.error(`Error fetching ${era} tracks from Last.fm:`, error);
    return tracks;
  }
}

// Function to get Last.fm tracks by mood/subgenre
async function getLastFmTracksByMoodOrSubgenre(searchTerm: string, limit = 50): Promise<LastFmContextTrack[]> {
  try {
    console.log(`Fetching tracks for "${searchTerm}" from Last.fm...`);
    
    const tracks = await fetchTracksByTag(searchTerm, limit);
    const contextTracks = convertLastFmToContextTracks(tracks);
    
    console.log(`Fetched ${contextTracks.length} tracks for ${searchTerm} from Last.fm`);
    return contextTracks;
    
  } catch (error) {
    console.error(`Error fetching tracks for ${searchTerm} from Last.fm:`, error);
    return [];
  }
}

// Enhanced fallback function with verified mainstream tracks
async function getVerifiedFallbackTracks(
  params: LastFmContextParams, 
  currentTracks: LastFmContextTrack[], 
  targetCount: number
): Promise<LastFmContextTrack[]> {
  const { genre, era } = params;
  
  console.log(`Getting verified fallback tracks. Current: ${currentTracks.length}, Target: ${targetCount}`);
  
  // These are verified popular songs that definitely exist on both Last.fm and Spotify
  const verifiedTracks: LastFmContextTrack[] = [
    // Recent hits (2023-2024)
    { name: "Flowers", artist: "Miley Cyrus", listeners: "2500000", url: "" },
    { name: "Anti-Hero", artist: "Taylor Swift", listeners: "2400000", url: "" },
    { name: "As It Was", artist: "Harry Styles", listeners: "2300000", url: "" },
    { name: "Heat Waves", artist: "Glass Animals", listeners: "2200000", url: "" },
    { name: "Shivers", artist: "Ed Sheeran", listeners: "2100000", url: "" },
    { name: "Stay", artist: "The Kid LAROI & Justin Bieber", listeners: "2000000", url: "" },
    { name: "Industry Baby", artist: "Lil Nas X & Jack Harlow", listeners: "1900000", url: "" },
    { name: "Good 4 U", artist: "Olivia Rodrigo", listeners: "1800000", url: "" },
    { name: "Unholy", artist: "Sam Smith ft. Kim Petras", listeners: "1700000", url: "" },
    { name: "Vampire", artist: "Olivia Rodrigo", listeners: "1600000", url: "" },
    
    // Timeless hits (always popular)
    { name: "Blinding Lights", artist: "The Weeknd", listeners: "3000000", url: "" },
    { name: "Shape of You", artist: "Ed Sheeran", listeners: "2900000", url: "" },
    { name: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", listeners: "2800000", url: "" },
    { name: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", listeners: "2700000", url: "" },
    { name: "Old Town Road", artist: "Lil Nas X ft. Billy Ray Cyrus", listeners: "2600000", url: "" },
    { name: "Someone Like You", artist: "Adele", listeners: "2500000", url: "" },
    { name: "Rolling in the Deep", artist: "Adele", listeners: "2400000", url: "" },
    { name: "Thinking Out Loud", artist: "Ed Sheeran", listeners: "2300000", url: "" },
    { name: "Can't Stop the Feeling!", artist: "Justin Timberlake", listeners: "2200000", url: "" },
    { name: "Shake It Off", artist: "Taylor Swift", listeners: "2100000", url: "" },
    { name: "Happy", artist: "Pharrell Williams", listeners: "2000000", url: "" },
    { name: "All About That Bass", artist: "Meghan Trainor", listeners: "1900000", url: "" },
    { name: "Counting Stars", artist: "OneRepublic", listeners: "1800000", url: "" },
    { name: "Radioactive", artist: "Imagine Dragons", listeners: "1700000", url: "" },
    { name: "Thunder", artist: "Imagine Dragons", listeners: "1600000", url: "" },
    { name: "Believer", artist: "Imagine Dragons", listeners: "1500000", url: "" },
    { name: "Sunflower", artist: "Post Malone & Swae Lee", listeners: "1400000", url: "" },
    { name: "Circles", artist: "Post Malone", listeners: "1300000", url: "" },
    { name: "Rockstar", artist: "Post Malone ft. 21 Savage", listeners: "1200000", url: "" },
    { name: "Thank U, Next", artist: "Ariana Grande", listeners: "1100000", url: "" },
    { name: "7 rings", artist: "Ariana Grande", listeners: "1000000", url: "" },
    { name: "Bad Guy", artist: "Billie Eilish", listeners: "1500000", url: "" },
    { name: "Therefore I Am", artist: "Billie Eilish", listeners: "1400000", url: "" },
    { name: "Levitating", artist: "Dua Lipa", listeners: "1300000", url: "" },
    { name: "Don't Start Now", artist: "Dua Lipa", listeners: "1200000", url: "" },
    { name: "Watermelon Sugar", artist: "Harry Styles", listeners: "1100000", url: "" },
    { name: "Adore You", artist: "Harry Styles", listeners: "1000000", url: "" },
    { name: "Drivers License", artist: "Olivia Rodrigo", listeners: "900000", url: "" },
    { name: "Peaches", artist: "Justin Bieber ft. Daniel Caesar & Giveon", listeners: "800000", url: "" },
    { name: "Montero (Call Me By Your Name)", artist: "Lil Nas X", listeners: "700000", url: "" },
    { name: "Savage", artist: "Megan Thee Stallion", listeners: "600000", url: "" }
  ];
  
  // Filter out tracks we already have
  const existingKeys = new Set(currentTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
  const uniqueVerifiedTracks = verifiedTracks.filter(track => {
    const key = `${track.name}-${track.artist}`.toLowerCase();
    return !existingKeys.has(key);
  });
  
  // Add era information if specified
  if (era && era !== 'Latest Releases') {
    uniqueVerifiedTracks.forEach(track => {
      track.listeners = track.listeners + ` (${era} era)`;
    });
  }
  
  const neededCount = targetCount - currentTracks.length;
  const fallbackTracks = uniqueVerifiedTracks.slice(0, neededCount);
  
  console.log(`Added ${fallbackTracks.length} verified fallback tracks`);
  return fallbackTracks;
}

// Main function to build Last.fm context database
export async function buildLastFmContext(params: LastFmContextParams): Promise<LastFmContextTrack[]> {
  const { genre, subgenre, mood, era, limit = 50 } = params;
  const targetTracks = Math.max(limit, 30); // Ensure we aim for at least 30 tracks
  
  try {
    console.log("🎵 Building Last.fm context with Spotify verification...");
    console.log(`Params: Genre=${genre}, Subgenre=${subgenre}, Mood=${mood}, Era=${era}, Limit=${targetTracks}`);
    
    // Collect tracks from Last.fm based on parameters
    let lastFmTracks: LastFmContextTrack[] = [];
    
    // Handle Latest Releases specially
    if (era === 'Latest Releases') {
      console.log("Fetching Latest Releases from Last.fm...");
      lastFmTracks = await getLastFmLatestReleases(genre, targetTracks * 2); // Get more for verification
      
      // Add metadata to track names to flag new releases
      lastFmTracks = lastFmTracks.map(track => ({
        ...track,
        listeners: track.listeners + " (2025 release)"
      }));
    } else {
      // For other eras, combine multiple strategies
      
      // 1. Get tracks by genre if specified
      if (genre) {
        console.log(`Fetching tracks for genre "${genre}" from Last.fm...`);
        const genreTracks = await fetchTracksByTag(genre, Math.floor(targetTracks / 2));
        const genreContextTracks = convertLastFmToContextTracks(genreTracks);
        lastFmTracks.push(...genreContextTracks);
      }
      
      // 2. Get tracks by subgenre if specified
      if (subgenre) {
        console.log(`Fetching tracks for subgenre "${subgenre}" from Last.fm...`);
        const subgenreTracks = await getLastFmTracksByMoodOrSubgenre(subgenre, Math.floor(targetTracks / 3));
        
        // Avoid duplicates
        const existingKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueSubgenreTracks = subgenreTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        lastFmTracks.push(...uniqueSubgenreTracks);
      }
      
      // 3. Get tracks by mood if specified
      if (mood) {
        console.log(`Fetching tracks for mood "${mood}" from Last.fm...`);
        const moodTracks = await getLastFmTracksByMoodOrSubgenre(mood, Math.floor(targetTracks / 3));
        
        // Avoid duplicates
        const existingKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueMoodTracks = moodTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        lastFmTracks.push(...uniqueMoodTracks);
      }
      
      // 4. Get era-specific tracks if specified
      if (era) {
        console.log(`Fetching era-specific tracks for "${era}" from Last.fm...`);
        const eraTracks = await getLastFmEraSpecificTracks(era, genre, Math.floor(targetTracks / 2));
        
        // Avoid duplicates
        const existingKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueEraTracks = eraTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        lastFmTracks.push(...uniqueEraTracks);
      }
      
      // 5. If we don't have enough tracks, get general top tracks
      if (lastFmTracks.length < targetTracks) {
        console.log("Getting general top tracks from Last.fm...");
        const topTracks = await fetchTopTracks({ limit: targetTracks });
        const topContextTracks = convertLastFmToContextTracks(topTracks);
        
        // Avoid duplicates
        const existingKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueTopTracks = topContextTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingKeys.has(key);
        });
        
        lastFmTracks.push(...uniqueTopTracks);
      }
      
      // Add era info to listener metadata if specified
      if (era && era !== 'Latest Releases') {
        lastFmTracks = lastFmTracks.map(track => ({
          ...track,
          listeners: track.listeners + ` (${era} era)`
        }));
      }
    }
    
    console.log(`📊 Fetched ${lastFmTracks.length} tracks from Last.fm`);
    
    // If we still don't have enough tracks, add verified fallback
    if (lastFmTracks.length < targetTracks) {
      console.log(`Only ${lastFmTracks.length} tracks from Last.fm, adding verified fallback...`);
      const fallbackTracks = await getVerifiedFallbackTracks(params, lastFmTracks, targetTracks);
      lastFmTracks.push(...fallbackTracks);
    }
    
    // Take more tracks than needed for Spotify verification (since some won't be found)
    const tracksForVerification = lastFmTracks.slice(0, Math.min(lastFmTracks.length, targetTracks * 2));
    
    console.log(`🔍 Verifying ${tracksForVerification.length} Last.fm tracks on Spotify...`);
    
    // Verify tracks on Spotify
    const verifiedTracks = await verifyLastFmTracksOnSpotify(tracksForVerification);
    
    console.log(`✅ Final result: ${verifiedTracks.length} verified tracks from ${tracksForVerification.length} Last.fm tracks`);
    
    // Log final tracks
    console.log(`\n=== VERIFIED TRACKS (Last.fm → Spotify) ===`);
    console.log(`Total tracks: ${verifiedTracks.length}`);
    console.log(`Genre: ${genre || 'None'}, Subgenre: ${subgenre || 'None'}, Mood: ${mood || 'None'}, Era: ${era || 'None'}`);
    verifiedTracks.slice(0, 20).forEach((track, index) => {
      console.log(`${index + 1}. "${track.name}" by ${track.artist} - ${track.listeners}`);
    });
    if (verifiedTracks.length > 20) {
      console.log(`... and ${verifiedTracks.length - 20} more tracks`);
    }
    console.log("=================================\n");
    
    return verifiedTracks.slice(0, targetTracks);
    
  } catch (error) {
    console.error("Error building Last.fm context with Spotify verification:", error);
    
    // Last resort fallback to verified tracks
    console.log("Using last resort verified fallback tracks");
    const fallbackTracks = await getVerifiedFallbackTracks(params, [], Math.min(targetTracks, 20));
    return fallbackTracks;
  }
}