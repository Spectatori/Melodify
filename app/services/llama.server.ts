import { json } from "@remix-run/node";
import fetch from "node-fetch";
import { buildLastFmContext } from "./lastfm.server";
import { UserOptions } from "~/types/lastfm.types";

export async function callEnhancedLlama(userPrompt: string, userOptions: UserOptions) {
  console.log("Enhanced Llama function called with prompt:", userPrompt);
  
  try {
    // Fetch Last.fm context based on user options
    console.log("Fetching Last.fm context for options:", userOptions);
    
    let lastFmContext = [];
    let formattedTracks = "";
    
    try {
      lastFmContext = await buildLastFmContext({
        genre: userOptions.genre,
        subgenre: userOptions.subgenre,
        mood: userOptions.mood,
        era: userOptions.era,
        limit: 30 // Limit the number of tracks to keep the context manageable
      });
      
      // Format the Last.fm data for context
      formattedTracks = lastFmContext.length > 0 
        ? lastFmContext.slice(0, 30).map((track, index) => 
            `${index + 1}. "${track.name}" by ${track.artist}`
          ).join('\n')
        : "No recent tracks found from Last.fm. Please use your knowledge of popular music.";
    } catch (contextError) {
      console.error("Error getting Last.fm context:", contextError);
      formattedTracks = "Error fetching recent tracks from Last.fm. Please use your knowledge of popular music.";
    }
    
    // Create an enhanced prompt with Last.fm data
    const enhancedPrompt = `
You are a music recommendation assistant with knowledge of the latest music up through early 2025.

User Request: ${userPrompt}

IMPORTANT: The current date is March 2025. Please prioritize songs from 2023-2025 in your recommendations.

Here are some current popular tracks that match the user's preferences:
${formattedTracks}

Based on both your knowledge and the tracks listed above, please suggest 5 songs that match the user's request. Your recommendations should:

1. Focus heavily on songs from 2023-2025, unless the user specifically requested older music
2. Include the song title and artist name in a numbered list format
3. Address the specific criteria the user mentioned: 
   - Genre: ${userOptions.genre || 'None'} 
   - Subgenre: ${userOptions.subgenre || 'None'}
   - Mood: ${userOptions.mood || 'None'}
   - BPM: ${userOptions.bpm || 'None'}
   - Activity: ${userOptions.activity || 'None'} 
   - Era: ${userOptions.era || 'None'}
   - Time of day: ${userOptions.timeOfDay || 'None'}
   - Weather: ${userOptions.weather || 'None'}

For the most current recommendations, focus on artists who have released music recently like Taylor Swift, Billie Eilish, Olivia Rodrigo, SZA, Dua Lipa, The Weeknd, Bad Bunny, Sabrina Carpenter, Charli XCX, Chappell Roan, Drake, Travis Scott, and Post Malone.
`;

    console.log("Sending enhanced prompt to Llama");
    
    // Call the local Llama instance
    const response = await fetch("http://localhost:11434/api/generate", {
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

    const data = await response.json() as { response: string };
    console.log("Ollama API successful response received");
    return { content: data.response };
  } catch (error) {
    console.error("Enhanced Llama API error:", error);
    // Return a graceful error message or fallback to the regular Llama API
    return { 
      content: `Sorry, I couldn't generate recommendations with enhanced data. Here are some general recommendations based on your request:\n\n1. "Blinding Lights" by The Weeknd\n2. "Bad Guy" by Billie Eilish\n3. "As It Was" by Harry Styles\n4. "Heat Waves" by Glass Animals\n5. "Stay" by The Kid LAROI & Justin Bieber` 
    };
  }
}

import type { ActionFunction } from "@remix-run/node";

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