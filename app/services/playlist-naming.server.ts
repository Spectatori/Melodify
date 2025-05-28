// Create this file: app/services/playlist-naming.server.ts
import fetch from "node-fetch";
import { UserOptions } from "~/types/lastfm.types";

interface PlaylistNaming {
  name: string;
  description: string;
}

export async function generatePlaylistNaming(userOptions: UserOptions): Promise<PlaylistNaming> {
  try {
    // Build context for the LLM
    let context = "Create a creative playlist name and description for a music playlist with these characteristics:\n";
    
    if (userOptions.genre) {
      context += `- Genre: ${userOptions.genre}`;
      if (userOptions.subgenre) {
        context += ` (specifically ${userOptions.subgenre})`;
      }
      context += "\n";
    }
    
    if (userOptions.mood) {
      context += `- Mood: ${userOptions.mood}\n`;
    }
    
    if (userOptions.activity) {
      context += `- Activity: ${userOptions.activity}\n`;
    }
    
    if (userOptions.era) {
      context += `- Era: ${userOptions.era}\n`;
    }
    
    if (userOptions.timeOfDay) {
      context += `- Time of Day: ${userOptions.timeOfDay}\n`;
    }
    
    if (userOptions.weather) {
      context += `- Weather: ${userOptions.weather}\n`;
    }
    
    if (userOptions.bpm) {
      context += `- BPM: ${userOptions.bpm}\n`;
    }
    
    const prompt = `${context}

Create a creative, catchy playlist name and description. The name should be:
- Creative and memorable (not just "Rock Playlist" or "Happy Songs")
- 2-6 words long
- Evocative of the mood and style
- Something that would make someone want to listen

The description should be:
- 1-2 sentences
- Compelling and descriptive
- Professional but engaging
- Explain what makes this playlist special

Format your response as:
NAME: [playlist name]
DESCRIPTION: [playlist description]

Examples of good names:
- "Midnight Neon Dreams" (for synthwave/nighttime)
- "Coffee Shop Confessions" (for indie/acoustic/morning)
- "Thunder & Lightning" (for energetic rock)
- "Velvet Underground Vibes" (for chill/evening)
- "Solar Flare Beats" (for upbeat electronic)

Create the name and description now:`;

    console.log("Generating playlist name with AI...");
    
    // Call the local Llama instance
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.8, // More creative
          max_tokens: 200
        }
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Naming API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    
    // Parse the response
    const responseText = data.response.trim();
    const nameMatch = responseText.match(/NAME:\s*(.+?)(?:\n|$)/i);
    const descriptionMatch = responseText.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/i);
    
    let name = nameMatch ? nameMatch[1].trim().replace(/['"]/g, '') : '';
    let description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Fallback if parsing fails
    if (!name || !description) {
      console.log("Failed to parse AI response, using fallback");
      name = generateFallbackName(userOptions);
      description = generateFallbackDescription(userOptions);
    }
    
    // Clean up the name (remove quotes, extra spaces, etc.)
    name = name.replace(/^["']|["']$/g, '').trim();
    
    console.log(`Generated playlist name: "${name}"`);
    console.log(`Generated description: "${description}"`);
    
    return { name, description };
    
  } catch (error) {
    console.error("Error generating playlist name:", error);
    
    // Fallback to creative but deterministic naming
    return {
      name: generateFallbackName(userOptions),
      description: generateFallbackDescription(userOptions)
    };
  }
}

function generateFallbackName(userOptions: UserOptions): string {
  const creativeTemplates = [
    // Mood-based
    ...(userOptions.mood ? [
      `${userOptions.mood} ${userOptions.timeOfDay || 'Vibes'}`,
      `${userOptions.mood} ${userOptions.genre || 'Sounds'}`,
      `${userOptions.mood} ${userOptions.activity || 'Sessions'}`
    ] : []),
    
    // Genre-based
    ...(userOptions.genre ? [
      `${userOptions.genre} ${userOptions.era || 'Chronicles'}`,
      `${userOptions.subgenre || userOptions.genre} ${userOptions.weather || 'Experience'}`,
      `${userOptions.genre} ${userOptions.timeOfDay || 'Collection'}`
    ] : []),
    
    // Activity-based
    ...(userOptions.activity ? [
      `${userOptions.activity} ${userOptions.mood || 'Soundtrack'}`,
      `${userOptions.activity} ${userOptions.genre || 'Beats'}`,
      `${userOptions.activity} ${userOptions.era || 'Mix'}`
    ] : []),
    
    // Weather-based
    ...(userOptions.weather ? [
      `${userOptions.weather} Day ${userOptions.genre || 'Playlist'}`,
      `${userOptions.weather} ${userOptions.mood || 'Moods'}`,
      `${userOptions.weather} Weather ${userOptions.activity || 'Vibes'}`
    ] : []),
    
    // Era-based
    ...(userOptions.era ? [
      `${userOptions.era} ${userOptions.genre || 'Classics'}`,
      `${userOptions.era} ${userOptions.mood || 'Memories'}`,
      `${userOptions.era} ${userOptions.activity || 'Revival'}`
    ] : []),
    
    // Default options
    'Perfect Mix',
    'Custom Curation',
    'Handpicked Hits',
    'Personal Soundtrack',
    'Mood & Music'
  ];
  
  // Filter out names with "undefined" and pick a random one
  const validNames = creativeTemplates.filter(name => 
    name && !name.includes('undefined') && !name.includes('null')
  );
  
  return validNames[Math.floor(Math.random() * validNames.length)] || 'Custom Playlist';
}

function generateFallbackDescription(userOptions: UserOptions): string {
  const elements = [];
  
  if (userOptions.genre) {
    elements.push(`${userOptions.genre}${userOptions.subgenre ? ` (${userOptions.subgenre})` : ''} music`);
  }
  
  if (userOptions.mood) {
    elements.push(`${userOptions.mood.toLowerCase()} vibes`);
  }
  
  if (userOptions.activity) {
    elements.push(`perfect for ${userOptions.activity.toLowerCase()}`);
  }
  
  if (userOptions.era) {
    elements.push(`from the ${userOptions.era}`);
  }
  
  if (userOptions.timeOfDay) {
    elements.push(`ideal for ${userOptions.timeOfDay.toLowerCase()}`);
  }
  
  if (userOptions.weather) {
    elements.push(`matching ${userOptions.weather.toLowerCase()} weather`);
  }
  
  let description = "A carefully curated playlist";
  if (elements.length > 0) {
    description += " featuring " + elements.join(", ");
  }
  
  description += ". Crafted by AI to match your exact musical preferences.";
  
  return description;
}