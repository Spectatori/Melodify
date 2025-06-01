import fetch from "node-fetch";
import { buildLastFmContext } from "./lastfm.server";
import { UserOptions, LastFmContextTrack } from "~/types/lastfm.types";
import { json, type ActionFunction } from "@remix-run/node";
import { musicVectorDB, RecommendationRecord } from "~/vector/vector-db-server";
import { spotifyDurationService } from "./duration-fetching.server";
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "~/utils/envExports";

// Keep track of previously recommended songs to avoid repetition
let previousRecommendations: Map<string, Set<string>> = new Map();

export async function callEnhancedLlama(userPrompt: string, userOptions: UserOptions, userId: string) {
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

    // STEP 0: Check for similar past recommendations to improve context
    console.log("🔍 Checking for similar past recommendations...");
    let similarRecommendations: RecommendationRecord[] = [];
    try {
      similarRecommendations = await musicVectorDB.findSimilarRecommendations(
        userPrompt, 
        userOptions, 
        userId, 
        3 // Get top 3 similar recommendations
      );
      
      if (similarRecommendations.length > 0) {
        console.log(`✅ Found ${similarRecommendations.length} similar past recommendations`);
      }
    } catch (error) {
      console.error("❌ Error finding similar recommendations:", error);
      // Continue without similar recommendations
    }
    
    // STEP 1: Fetch verified songs from Last.fm (already Spotify-verified)
    console.log("Fetching verified tracks from Last.fm with options:", userOptions);
    
    let lastFmTracks: LastFmContextTrack[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    const targetSongs = 50; // Target final songs since they're already verified
    
    // Try multiple times with increasing limits if we don't get enough verified songs
    while (lastFmTracks.length < targetSongs && attempts < maxAttempts) {
      attempts++;
      const requestLimit = 50 * attempts; // Increase limit with each attempt
      
      console.log(`Attempt ${attempts}: Requesting ${requestLimit} verified tracks from Last.fm`);
      
      try {
        // Use buildLastFmContext function to get Last.fm tracks verified on Spotify
        const newTracks = await buildLastFmContext({
          genre: userOptions.genre,
          subgenre: userOptions.subgenre,
          mood: userOptions.mood,
          era: userOptions.era,
          limit: requestLimit
        });
        
        // Combine with existing tracks, avoiding duplicates
        const existingTrackKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        const uniqueNewTracks = newTracks.filter(track => {
          const key = `${track.name}-${track.artist}`.toLowerCase();
          return !existingTrackKeys.has(key);
        });
        
        lastFmTracks = [...lastFmTracks, ...uniqueNewTracks];
        
        console.log(`Attempt ${attempts}: Got ${newTracks.length} verified tracks (${uniqueNewTracks.length} unique), total: ${lastFmTracks.length}`);
        
        // If we got a good amount on this attempt, stop trying
        if (newTracks.length >= requestLimit * 0.7) {
          break;
        }
        
      } catch (error) {
        console.error(`Error on attempt ${attempts}:`, error);
        
        // If we're on the last attempt and still have very few tracks, try a broader search
        if (attempts === maxAttempts && lastFmTracks.length < 20) {
          console.log("Final attempt: trying broader search without filters");
          try {
            const broadTracks = await buildLastFmContext({
              genre: userOptions.genre || "pop", // Use pop as fallback
              limit: 50
            });
            
            const existingTrackKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
            const uniqueBroadTracks = broadTracks.filter(track => {
              const key = `${track.name}-${track.artist}`.toLowerCase();
              return !existingTrackKeys.has(key);
            });
            
            lastFmTracks = [...lastFmTracks, ...uniqueBroadTracks];
            console.log(`Broad search added ${uniqueBroadTracks.length} more verified tracks, total: ${lastFmTracks.length}`);
          } catch (broadError) {
            console.error("Broad search also failed:", broadError);
          }
        }
      }
    }
    
    console.log(`Final result: ${lastFmTracks.length} verified tracks from Last.fm after ${attempts} attempts`);
    
    // If we still don't have enough verified tracks, add some emergency fallback tracks
    if (lastFmTracks.length < 20) {
      console.warn(`Only received ${lastFmTracks.length} verified tracks from APIs, adding fallback tracks`);
      
      // These are verified tracks that are known to exist on both Last.fm and Spotify
      const fallbackTracks: LastFmContextTrack[] = [
        { name: "Blinding Lights", artist: "The Weeknd", listeners: "3000000", url: "" },
        { name: "Shape of You", artist: "Ed Sheeran", listeners: "2900000", url: "" },
        { name: "Dance The Night", artist: "Dua Lipa", listeners: "2800000", url: "" },
        { name: "As It Was", artist: "Harry Styles", listeners: "2700000", url: "" },
        { name: "Anti-Hero", artist: "Taylor Swift", listeners: "2600000", url: "" },
        { name: "Flowers", artist: "Miley Cyrus", listeners: "2500000", url: "" },
        { name: "Unholy", artist: "Sam Smith ft. Kim Petras", listeners: "2400000", url: "" },
        { name: "Heat Waves", artist: "Glass Animals", listeners: "2300000", url: "" },
        { name: "Stay", artist: "The Kid LAROI & Justin Bieber", listeners: "2200000", url: "" },
        { name: "Good 4 U", artist: "Olivia Rodrigo", listeners: "2100000", url: "" },
        { name: "Levitating", artist: "Dua Lipa", listeners: "2000000", url: "" },
        { name: "Watermelon Sugar", artist: "Harry Styles", listeners: "1900000", url: "" },
        { name: "Therefore I Am", artist: "Billie Eilish", listeners: "1800000", url: "" },
        { name: "positions", artist: "Ariana Grande", listeners: "1700000", url: "" },
        { name: "Mood", artist: "24kGoldn ft. iann dior", listeners: "1600000", url: "" },
        { name: "Rockstar", artist: "DaBaby ft. Roddy Ricch", listeners: "1500000", url: "" },
        { name: "The Box", artist: "Roddy Ricch", listeners: "1400000", url: "" },
        { name: "Circles", artist: "Post Malone", listeners: "1300000", url: "" },
        { name: "Don't Start Now", artist: "Dua Lipa", listeners: "1200000", url: "" },
        { name: "Savage", artist: "Megan Thee Stallion", listeners: "1100000", url: "" }
      ];
      
      // Add fallback tracks that aren't already in the list
      const existingTrackKeys = new Set(lastFmTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
      const neededFallbackTracks = fallbackTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !existingTrackKeys.has(key);
      }).slice(0, Math.max(0, 30 - lastFmTracks.length)); // Add up to 30 total tracks
      
      lastFmTracks = [...lastFmTracks, ...neededFallbackTracks];
      
      console.log(`Added ${neededFallbackTracks.length} verified fallback tracks, total: ${lastFmTracks.length}`);
    }
    
    // STEP 2: Create a unique key for tracking previously recommended songs
    const optionsKey = `${userOptions.genre || 'any'}-${userOptions.era || 'any'}-${userOptions.subgenre || 'any'}-${userOptions.mood || 'any'}`;
    
    // Initialize the set of previously recommended songs if needed
    if (!previousRecommendations.has(optionsKey)) {
      previousRecommendations.set(optionsKey, new Set());
    }
    
    // Get previously recommended songs for these options
    const previousSongsForOptions = previousRecommendations.get(optionsKey)!;
    
    // Add songs from vector DB similar recommendations to avoid repetition
    if (similarRecommendations.length > 0) {
      console.log("📚 Adding songs from similar recommendations to avoid duplicates");
      for (const similarRec of similarRecommendations) {
        for (const song of similarRec.songs) {
          // Extract song-artist key for deduplication
          const matches = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+?)$/);
          if (matches) {
            const key = `${matches[1]}-${matches[2].trim()}`.toLowerCase();
            previousSongsForOptions.add(key);
          }
        }
      }
    }
    
    // STEP 3: Filter out previously recommended songs
    const newTracks = lastFmTracks.filter(track => {
      const key = `${track.name}-${track.artist}`.toLowerCase();
      return !previousSongsForOptions.has(key);
    });
    
    console.log(`After filtering previously recommended songs, ${newTracks.length} tracks remain`);
    
    // Choose which tracks to use based on what's available
    let tracksToUse = newTracks.length >= 25 ? newTracks : lastFmTracks;
    
    // If we have very few tracks even after considering all available, reset history
    if (tracksToUse.length < 15) {
      console.log("Very few tracks available, clearing recommendation history");
      previousSongsForOptions.clear();
      tracksToUse = lastFmTracks;
    }
    
    // STEP 4: Format tracks for the LLM to choose from
    // First, shuffle the tracks for variety
    const shuffledTracks = [...tracksToUse].sort(() => Math.random() - 0.5);
    
    // Take a good pool of verified tracks for the LLM to choose from
    const poolSize = Math.min(Math.max(30, shuffledTracks.length), 50);
    const selectedTracks = shuffledTracks.slice(0, poolSize);
    
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
    
    // STEP 5: Build enhanced prompt with similar recommendations context
    let similarRecommendationsContext = "";
    if (similarRecommendations.length > 0) {
      const contextSongs = similarRecommendations
        .flatMap(rec => rec.songs.slice(0, 5)) // Take first 5 songs from each similar recommendation
        .slice(0, 15); // Limit to 15 songs total for context
      
      similarRecommendationsContext = `

CONTEXT: The user has previously received similar recommendations:
${contextSongs.join('\n')}

Please consider this history but DO NOT repeat these songs. Instead, find complementary tracks that would work well with their previous preferences.`;
    }

    // STEP 5: Have Llama choose the best 20 songs from our verified pool
    const enhancedPrompt = `
You are a music recommendation assistant. I've already gathered a pool of verified songs from Last.fm that are confirmed to exist on Spotify, and I need you to select 20 of them that would make a great playlist.

IMPORTANT: All songs provided have been verified to exist on Spotify. Focus on creating the best possible playlist from these verified options.

User Request: ${userPrompt}

${userOptions.genre ? `The user is looking for ${userOptions.genre} songs.` : ''}
${userOptions.era ? `The time period selected is: ${userOptions.era}.` : ''}
${userOptions.subgenre ? `The subgenre preference is: ${userOptions.subgenre}.` : ''}
${userOptions.mood ? `The mood requested is: ${userOptions.mood}.` : ''}
${userOptions.bpm ? `The BPM range is: ${userOptions.bpm}.` : ''}
${userOptions.activity ? `The activity context is: ${userOptions.activity}.` : ''}
${userOptions.timeOfDay ? `The time of day is: ${userOptions.timeOfDay}.` : ''}
${userOptions.weather ? `The weather is: ${userOptions.weather}.` : ''}${similarRecommendationsContext}

Here is the pool of verified songs from Last.fm that match these criteria:
${formattedTracks}

INSTRUCTIONS:
1. Select exactly 20 songs from the above list that would make the best playlist.
2. Create a diverse, well-balanced playlist that flows well together.
3. Format your response as a numbered list with ONLY the song names and artists.
4. DO NOT add any explanations, commentary, or additional information.
5. Use exactly this format: 1. "Song Title" by Artist
6. DO NOT invent or make up new songs - ONLY use songs from the provided verified list.
7. Prioritize songs marked as "Genre Match" if present, as they best match the user's genre preference.
8. If "Recent Release" is marked, those songs are good choices for "Latest Releases" requests.
9. If a specific era is marked (like "${userOptions.era} Era"), prioritize those songs as they match the user's time period preference.
10. Consider the user's recommendation history context but avoid repeating previously recommended songs.
11. Aim for variety within the selected criteria - don't pick all songs from one artist unless specifically requested.
12. Create a good flow for the playlist - consider energy levels, tempo, and mood progression.

Your 20 song recommendations:
`;

    console.log("Sending enhanced prompt to Llama for 20-song playlist from verified tracks");
    
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
          options: {
            temperature: 0.7, // Slightly more focused than before for better consistency
            top_p: 0.9,
            top_k: 40,
            num_ctx: 4096 // Increase context window for better handling of longer lists
          }
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
    
    console.log(`LLM returned ${songLines.length} songs, target was 20`);
    
    // If we don't have exactly 20 songs, adjust
    if (songLines.length !== 20) {
      console.log(`LLM returned ${songLines.length} songs, adjusting to 20`);
      
      // If we have more than 20, take the first 20
      if (songLines.length > 20) {
        songLines.splice(20);
      } 
      // If we have less than 20, add some from our verified pool
      else if (songLines.length < 20 && selectedTracks.length > songLines.length) {
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
        
        // Add more tracks until we have 20
        for (let i = 0; i < shuffledRemaining.length && songLines.length < 20; i++) {
          const track = shuffledRemaining[i];
          songLines.push(`${songLines.length + 1}. "${track.name}" by ${track.artist}`);
        }
        
        console.log(`Added ${20 - songLines.length} songs from remaining verified pool to reach 20 total`);
      }
    }
    
    // Fix numbering to ensure it's sequential
    const reNumberedSongs = songLines.map((line, index) => {
      // Replace the number at the beginning with the correct index
      return line.replace(/^\d+\./, `${index + 1}.`);
    });
    
    // If we still don't have 20 songs, pad with random tracks from our verified pool
    while (reNumberedSongs.length < 20 && selectedTracks.length > reNumberedSongs.length) {
      const usedSongs = new Set(reNumberedSongs.map(line => {
        const matches = line.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+?)$/);
        if (matches) {
          return `${matches[1]}-${matches[2].trim()}`.toLowerCase();
        }
        return "";
      }));
      
      const availableTracks = selectedTracks.filter(track => {
        const key = `${track.name}-${track.artist}`.toLowerCase();
        return !usedSongs.has(key);
      });
      
      if (availableTracks.length === 0) break;
      
      const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
      reNumberedSongs.push(`${reNumberedSongs.length + 1}. "${randomTrack.name}" by ${randomTrack.artist}`);
    }
    
    console.log(`Final verified playlist has ${reNumberedSongs.length} songs`);
    
    // STEP 7: Track these songs as recommended
    reNumberedSongs.forEach(line => {
      const matches = line.match(/^\d+\.\s*"([^"]+)"\s*by\s*([^(]+)/);
      if (matches) {
        const [, songName, artistName] = matches;
        const key = `${songName}-${artistName.trim()}`.toLowerCase();
        previousSongsForOptions.add(key);
      }
    });

    // STEP 8: Store the recommendation in vector database
    await storeRecommendationInVectorDB(
      userPrompt,
      userOptions,
      userId,
      data.response,
      reNumberedSongs
    );
    
    // Return the final list of verified recommendations
    return { content: reNumberedSongs.join('\n') };
  } catch (error) {
    console.error("Enhanced Llama API error:", error);
    
    // Return a graceful error message
    return { 
      content: "Sorry, I couldn't generate specific recommendations based on your criteria at this time. Please try again or adjust your preferences." 
    };
  }
}

// Helper function to store recommendation in vector database
async function storeRecommendationInVectorDB(
  userPrompt: string,
  userOptions: UserOptions,
  userId: string,
  aiResponse: string,
  songs: string[]
): Promise<void> {
  try {
    // Fetch real song details from Spotify
    console.log('🎵 Fetching song details from Spotify...');
    const songDetails = await spotifyDurationService.getSongDetails(songs);

    const recommendationRecord: RecommendationRecord = {
      id: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      timestamp: new Date().toISOString(),
      userPrompt: userPrompt,
      userOptions: userOptions,
      aiResponse: aiResponse,
      songs: songs,
      songDetails: songDetails // Add the real song details
    };

    await musicVectorDB.storeRecommendation(recommendationRecord);
    console.log(`✅ Stored recommendation with song details in vector database: ${recommendationRecord.id}`);
  } catch (error) {
    console.error("❌ Error storing recommendation in vector database:", error);
    // Don't fail the whole operation if vector storage fails
  }
}

export const action: ActionFunction = async ({ request }) => {
  console.log("Enhanced Llama API action function called");
  try {
    const formData = await request.formData();
    
    // Get the basic prompt
    const prompt = formData.get("prompt")?.toString() || "Suggest me some songs";
    
    // Get user ID (you'll need to get this from session)
    const userId = formData.get("userId")?.toString() || "anonymous";
    
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
    
    const response = await callEnhancedLlama(prompt, userOptions, userId);
    console.log("Returning enhanced API response");
    return json(response);
  } catch (error) {
    console.error("Enhanced API action error:", error);
    return json({ error: (error instanceof Error) ? error.message : String(error) });
  }
};