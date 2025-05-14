import fetch from "node-fetch";
import { buildLastFmContext } from "./lastfm.server";
import { UserOptions, LastFmContextTrack } from "~/types/lastfm.types";
import { json, type ActionFunction } from "@remix-run/node";

// Keep track of previously recommended songs to avoid repetition
let previousRecommendations: Map<string, Set<string>> = new Map();

export async function callEnhancedLlama(userPrompt: string, userOptions: UserOptions) {
  console.log("Enhanced Llama function called with prompt:", userPrompt);
  
  try {
    // Validate inputs
    if (!userPrompt) {
      console.warn("Empty prompt received, using default");
      userPrompt = "Suggest me some songs";
    }
    
    // Check if at least one filter option is provided
    const hasFilterOption = userOptions.genre || userOptions.subgenre || 
                           userOptions.mood || userOptions.era || 
                           userOptions.activity || userOptions.bpm;
    
    if (!hasFilterOption) {
      console.warn("No filter options provided, recommendations may be generic");
    }
    
    // STEP 1: Fetch songs from Last.fm/Spotify via buildLastFmContext
    console.log("Fetching tracks from Last.fm/Spotify with options:", userOptions);
    
    let lastFmTracks: LastFmContextTrack[] = [];
    try {
      // Use your existing buildLastFmContext function to get relevant tracks
      lastFmTracks = await buildLastFmContext({
        genre: userOptions.genre,
        subgenre: userOptions.subgenre,
        mood: userOptions.mood,
        era: userOptions.era,
        limit: 50 // Request more tracks to ensure we have enough to choose from
      });
      
      console.log(`Received ${lastFmTracks.length} tracks from LastFM/Spotify`);
    } catch (error) {
      console.error("Error fetching from LastFM/Spotify:", error);
    }
    
    // If we don't have enough tracks, log a warning
    if (lastFmTracks.length < 10) {
      console.warn(`Only received ${lastFmTracks.length} tracks from APIs, recommendations may be limited`);
    }
    
    // STEP 2: Create a unique key for tracking previously recommended songs
    const optionsKey = `${userOptions.genre || 'any'}-${userOptions.era || 'any'}-${userOptions.subgenre || 'any'}-${userOptions.mood || 'any'}`;
    
    // Initialize the set of previously recommended songs if needed
    if (!previousRecommendations.has(optionsKey)) {
      previousRecommendations.set(optionsKey, new Set());
    }
    
    // Get previously recommended songs for these options
    const previousSongsForOptions = previousRecommendations.get(optionsKey)!;
    
    // STEP 3: Filter out previously recommended songs
    const newTracks = lastFmTracks.filter(track => {
      const key = `${track.name}-${track.artist}`.toLowerCase();
      return !previousSongsForOptions.has(key);
    });
    
    console.log(`After filtering previously recommended songs, ${newTracks.length} tracks remain`);
    
    // Choose which tracks to use based on what's available
    let tracksToUse = newTracks.length >= 5 ? newTracks : lastFmTracks;
    
    // If we have very few tracks even after considering all available, reset history
    if (tracksToUse.length < 5) {
      console.log("Very few tracks available, clearing recommendation history");
      previousSongsForOptions.clear();
      tracksToUse = lastFmTracks;
    }
    
    // STEP 4: Format tracks for the LLM to choose from
    // First, shuffle the tracks for variety
    const shuffledTracks = [...tracksToUse].sort(() => Math.random() - 0.5);
    
    // Take the first 20 tracks (or fewer if we don't have that many)
    const selectedTracks = shuffledTracks.slice(0, Math.min(20, shuffledTracks.length));
    
    // If we have 5 or fewer tracks, just return them directly without LLM
    if (selectedTracks.length <= 5) {
      console.log("5 or fewer tracks available, returning directly without LLM");
      
      // Track these as recommended
      for (const track of selectedTracks) {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        previousSongsForOptions.add(key);
      }
      
      // Format as a numbered list
      const formattedSongs = selectedTracks.map((track, index) => 
        `${index + 1}. "${track.name}" by ${track.artist}`
      );
      
      return { content: formattedSongs.join('\n') };
    }
    
    // Format the tracks into a string for the LLM
    const formattedTracks = selectedTracks.map((track, index) => {
      let extraInfo = "";
      
      // Include genre/mood/era info if available in the listeners field
      if (typeof track.listeners === 'string') {
        if (track.listeners.includes("Priority Genre Match")) {
          extraInfo += " (Genre Match)";
        }
        if (track.listeners.includes("2025 release") || track.listeners.includes("2024 release")) {
          extraInfo += " (Recent Release)";
        }
        if (track.listeners.includes("era")) {
          extraInfo += ` (${userOptions.era} Era)`;
        }
      }
      
      return `${index + 1}. "${track.name}" by ${track.artist}${extraInfo}`;
    }).join('\n');
    
    // STEP 5: Have Llama choose the best 5 songs from our pool
    const enhancedPrompt = `
You are a music recommendation assistant. I've already gathered a pool of songs that match the user's criteria from LastFM/Spotify, and I need you to select 5 of them that would make good recommendations.

User Request: ${userPrompt}

${userOptions.genre ? `The user is looking for ${userOptions.genre} songs.` : ''}
${userOptions.era ? `The time period selected is: ${userOptions.era}.` : ''}
${userOptions.subgenre ? `The subgenre preference is: ${userOptions.subgenre}.` : ''}
${userOptions.mood ? `The mood requested is: ${userOptions.mood}.` : ''}
${userOptions.bpm ? `The BPM range is: ${userOptions.bpm}.` : ''}
${userOptions.activity ? `The activity context is: ${userOptions.activity}.` : ''}
${userOptions.timeOfDay ? `The time of day is: ${userOptions.timeOfDay}.` : ''}
${userOptions.weather ? `The weather is: ${userOptions.weather}.` : ''}

Here is the pool of songs from LastFM/Spotify that match these criteria:
${formattedTracks}

INSTRUCTIONS:
1. Select exactly 5 songs from the above list that would make the best recommendations.
2. Format your response as a numbered list with ONLY the song names and artists.
3. DO NOT add any explanations, commentary, or additional information.
4. Use exactly this format: 1. "Song Title" by Artist
5. DO NOT invent or make up new songs - ONLY use songs from the provided list.
6. Prioritize songs marked as "Genre Match" if present, as they best match the user's genre preference.
7. If "Recent Release" is marked, those songs are good choices for "Latest Releases" requests.
8. If a specific era is marked (like "${userOptions.era} Era"), prioritize those songs as they match the user's time period preference.

Your recommendations:
`;

    console.log("Sending enhanced prompt to Llama");
    
    // Call the local Llama instance
    let response;
    try {
      response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2",
          prompt: enhancedPrompt,
          stream: false,
        }),
      });
      
      console.log("Ollama API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error response:", errorText);
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      // Handle network errors or Ollama service not running
      console.error("Error connecting to Ollama service:", error);
      throw new Error("Unable to connect to recommendation service. Is Ollama running?");
    }

    const data = await response.json() as { response: string };
    console.log("Ollama API successful response received");

    // STEP 6: Process the LLM response
    // Extract only the numbered list items
    const songLines = data.response.trim().split('\n')
      .filter(line => /^\d+\.\s*"[^"]+"\s*by\s*.+/.test(line.trim()))
      .map(line => line.trim());
    
    // If we don't have exactly 5 songs, adjust
    if (songLines.length !== 5) {
      console.log(`LLM returned ${songLines.length} songs, adjusting to 5`);
      
      // If we have more than 5, take the first 5
      if (songLines.length > 5) {
        songLines.splice(5);
      } 
      // If we have less than 5, add some from our pool
      else if (songLines.length < 5 && selectedTracks.length > songLines.length) {
        // Determine which songs were already selected
        const selectedSongKeys = new Set(songLines.map(line => {
          const matches = line.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+?)$/);
          if (matches) {
            return `${matches[1]}-${matches[2].trim()}`.toLowerCase();
          }
          return "";
        }).filter(key => key));
        
        // Find tracks that weren't selected yet
        const remainingTracks = selectedTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !selectedSongKeys.has(key);
        });
        
        // Shuffle remaining tracks
        const shuffledRemaining = [...remainingTracks].sort(() => Math.random() - 0.5);
        
        // Add more tracks until we have 5
        for (let i = 0; i < shuffledRemaining.length && songLines.length < 5; i++) {
          const track = shuffledRemaining[i];
          songLines.push(`${songLines.length + 1}. "${track.name}" by ${track.artist}`);
        }
      }
    }
    
    // Fix numbering to ensure it's sequential
    const reNumberedSongs = songLines.map((line, index) => {
      // Replace the number at the beginning with the correct index
      return line.replace(/^\d+\./, `${index + 1}.`);
    });
    
    // STEP 7: Track these songs as recommended
    reNumberedSongs.forEach(line => {
      const matches = line.match(/^\d+\.\s*"([^"]+)"\s*by\s*([^(]+)/);
      if (matches) {
        const [, songName, artistName] = matches;
        const key = `${songName}-${artistName.trim()}`.toLowerCase();
        previousSongsForOptions.add(key);
      }
    });
    
    // Return the final list of recommendations
    return { content: reNumberedSongs.join('\n') };
  } catch (error) {
    console.error("Enhanced Llama API error:", error);
    
    // Return a graceful error message
    return { 
      content: "Sorry, I couldn't generate specific recommendations based on your criteria at this time. Please try again or adjust your preferences." 
    };
  }
}

export const action: ActionFunction = async ({ request }) => {
  console.log("Enhanced Llama API action function called");
  try {
    const formData = await request.formData();
    
    // Get the basic prompt
    const prompt = formData.get("prompt")?.toString() || "Suggest me some songs";
    
    // Get all the filter options
    const userOptions: UserOptions = {
      genre: formData.get("genre")?.toString() || undefined,
      subgenre: formData.get("subgenre")?.toString() || undefined,
      mood: formData.get("mood")?.toString() || undefined,
      bpm: formData.get("bpm")?.toString() || undefined,
      activity: formData.get("activity")?.toString() || undefined,
      era: formData.get("era")?.toString() || undefined,
      timeOfDay: formData.get("timeOfDay")?.toString() || undefined,
      weather: formData.get("weather")?.toString() || undefined,
    };
    
    console.log("Received options:", userOptions);
    
    const response = await callEnhancedLlama(prompt, userOptions);
    console.log("Returning enhanced API response");
    return json(response);
  } catch (error) {
    console.error("Enhanced API action error:", error);
    return json({ error: (error instanceof Error) ? error.message : String(error) });
  }
}