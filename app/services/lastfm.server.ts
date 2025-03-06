import fetch from "node-fetch";
import { 
  LastFmTrack, 
  LastFmTopTracksResponse, 
  LastFmTagTracksResponse,
  LastFmSearchTracksResponse,
  LastFmContextTrack,
  LastFmContextParams
} from "~/types/lastfm.types";

// Last.fm API configuration
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "ea15dbb7d3f5ade401bb19b631ff438c";
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

// Function to fetch recent top tracks from Last.fm
export async function fetchTopTracks(params: {
  limit?: number;
  page?: number;
  genre?: string;
}): Promise<LastFmTrack[]> {
  const { limit = 50, page = 1, genre } = params;
  
  try {
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

// Function to fetch tracks by tag (genre/mood)
export async function fetchTracksByTag(tag: string, limit = 50): Promise<LastFmTrack[]> {
  try {
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

// Function to search for tracks
export async function searchTracks(query: string, limit = 30): Promise<LastFmTrack[]> {
  try {
    const response = await fetch(
      `${LASTFM_API_URL}?method=track.search&track=${encodeURIComponent(query)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Last.fm API error response for search ${query}: ${response.status} - ${errorText}`);
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    
    const data = await response.json() as LastFmSearchTracksResponse;
    return data.results.trackmatches.track;
  } catch (error) {
    console.error(`Error searching Last.fm tracks for ${query}:`, error);
    return [];
  }
}

// Fallback function to get popular tracks when tag-based methods fail
export async function getPopularTracks(limit = 50): Promise<LastFmContextTrack[]> {
  try {
    // Use chart.getTopTracks as a reliable fallback
    const response = await fetch(
      `${LASTFM_API_URL}?method=chart.gettoptracks&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    
    const data = await response.json() as LastFmTopTracksResponse;
    
    // Format the tracks in our standard format
    return data.tracks.track.map(track => ({
      name: track.name,
      artist: track.artist.name,
      listeners: track.listeners || "Unknown",
      url: track.url || ""
    }));
  } catch (error) {
    console.error("Error fetching popular tracks as fallback:", error);
    // Return some default tracks if all else fails
    return [
      { name: "Shape of You", artist: "Ed Sheeran", listeners: "1000000" },
      { name: "Blinding Lights", artist: "The Weeknd", listeners: "950000" },
      { name: "Dance The Night", artist: "Dua Lipa", listeners: "850000" },
      { name: "As It Was", artist: "Harry Styles", listeners: "900000" },
      { name: "Cruel Summer", artist: "Taylor Swift", listeners: "870000" }
    ];
  }
}

export async function fetchRecentTracks(limit = 50): Promise<LastFmContextTrack[]> {
  try {
    // Use hypem or another service that has better data for new releases
    // For now, fall back to chart.getTopTracks, which at least gives recent popular tracks
    const response = await fetch(
      `${LASTFM_API_URL}?method=chart.gettoptracks&api_key=${LASTFM_API_KEY}&format=json&limit=${limit * 2}`
    );
    
    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    
    const data = await response.json() as LastFmTopTracksResponse;
    
    // Format the tracks in our standard format, taking only the first 'limit' entries
    return data.tracks.track.slice(0, limit).map(track => ({
      name: track.name,
      artist: track.artist.name,
      listeners: track.listeners || "Unknown",
      url: track.url || ""
    }));
  } catch (error) {
    console.error("Error fetching recent tracks:", error);
    return [];
  }
}

// Function to build a Last.fm context database for Llama
export async function buildLastFmContext(params: LastFmContextParams): Promise<LastFmContextTrack[]> {
  const { genre, subgenre, mood, era, limit = 50 } = params;
  
  try {
    // Collect tracks from multiple sources based on parameters
    let contextTracks: LastFmContextTrack[] = [];
    let tags: string[] = [];
    
    // Handle Latest Releases specially
    if (era === 'Latest Releases') {
      console.log("Fetching latest releases");
      const recentTracks = await fetchRecentTracks(limit);
      contextTracks.push(...recentTracks);
      
      // If we have genre/subgenre/mood, also fetch those with 2024 tag to be more specific
      if (genre || subgenre || mood) {
        if (genre) tags.push(genre.toLowerCase());
        if (subgenre) tags.push(subgenre.toLowerCase());
        if (mood) tags.push(mood.toLowerCase());
        
        // Also add the 2024 tag to each request
        for (const tag of tags) {
          try {
            // First try with 2024 tag combination
            const tagParam = `${tag},2024`;
            console.log(`Trying to fetch tracks with combined tag: ${tagParam}`);
            const tagTracks = await fetchTracksByTag(tagParam, Math.floor(limit / tags.length));
            
            if (tagTracks.length > 0) {
              const formattedTracks = tagTracks.map(track => ({
                name: track.name,
                artist: track.artist.name,
                listeners: track.listeners || "Unknown",
                url: track.url || ""
              }));
              
              contextTracks.push(...formattedTracks);
            }
          } catch (error) {
            console.warn(`Error fetching tracks for tag combination, continuing:`, error);
          }
        }
      }
      
      // If we still need more tracks, directly try the 2024 tag
      if (contextTracks.length < limit) {
        try {
          console.log("Fetching tracks with 2024 tag");
          const twentyFourTracks = await fetchTracksByTag("2024", limit - contextTracks.length);
          
          const formattedTracks = twentyFourTracks.map(track => ({
            name: track.name,
            artist: track.artist.name,
            listeners: track.listeners || "Unknown",
            url: track.url || ""
          }));
          
          contextTracks.push(...formattedTracks);
        } catch (error) {
          console.warn(`Error fetching 2024 tracks:`, error);
        }
      }
      
      console.log(`Fetched ${contextTracks.length} tracks for Latest Releases/2024`);
      return contextTracks;
    }
    
    // Regular handling for other eras
    // Add tags for fetching
    if (genre) tags.push(genre.toLowerCase());
    if (subgenre) tags.push(subgenre.toLowerCase());
    if (mood) tags.push(mood.toLowerCase());
    
    // Add era-specific tags if available
    if (era) {
      if (era === 'Modern (2010s-Present)') {
        tags.push('2010s', '2020s');
      } else if (era === 'Classic (1980s-2000s)') {
        tags.push('1980s', '1990s', '2000s');
      } else if (era === 'Vintage (1950s-1970s)') {
        tags.push('1950s', '1960s', '1970s');
      }
    }
    
    // Fetch tracks for each tag
    for (const tag of tags) {
      try {
        const tagTracks = await fetchTracksByTag(tag, Math.floor(limit / tags.length));
        
        // Convert to our standard format
        const formattedTracks = tagTracks.map(track => ({
          name: track.name,
          artist: track.artist.name,
          listeners: track.listeners || "Unknown",
          url: track.url || ""
        }));
        
        contextTracks.push(...formattedTracks);
      } catch (error) {
        console.warn(`Error fetching tracks for tag ${tag}, continuing with other tags:`, error);
      }
    }
    
    // If no specific tags or no results for the tags, fall back to top tracks
    if (contextTracks.length === 0) {
      console.log("No tracks found from tags, falling back to popular tracks");
      contextTracks = await getPopularTracks(limit);
    }
    
    console.log(`Successfully built context with ${contextTracks.length} tracks`);
    return contextTracks;
  } catch (error) {
    console.error("Error building Last.fm context:", error);
    // Return some default tracks as fallback so the app doesn't crash
    return await getPopularTracks(limit);
  }
}