// Create this file: app/services/playlist-image-prompt.server.ts
import fetch from "node-fetch";
import { UserOptions } from "~/types/lastfm.types";

export async function generatePlaylistImagePrompt(
  playlistName: string,
  playlistDescription: string,
  userOptions: UserOptions
): Promise<string> {
  try {
    // Build context for the LLM
    let context = `Create a detailed visual description for a playlist cover art image based on these characteristics:

Playlist Name: "${playlistName}"
Description: "${playlistDescription}"
`;
    
    if (userOptions.genre) {
      context += `\nGenre: ${userOptions.genre}`;
      if (userOptions.subgenre) {
        context += ` (specifically ${userOptions.subgenre})`;
      }
    }
    
    if (userOptions.mood) {
      context += `\nMood: ${userOptions.mood}`;
    }
    
    if (userOptions.activity) {
      context += `\nActivity: ${userOptions.activity}`;
    }
    
    if (userOptions.era) {
      context += `\nEra: ${userOptions.era}`;
    }
    
    if (userOptions.timeOfDay) {
      context += `\nTime of Day: ${userOptions.timeOfDay}`;
    }
    
    if (userOptions.weather) {
      context += `\nWeather: ${userOptions.weather}`;
    }
    
    if (userOptions.bpm) {
      context += `\nBPM: ${userOptions.bpm}`;
    }
    
    const prompt = `${context}

Create a detailed visual prompt for generating a playlist cover art image. The prompt should be:
- Visually descriptive and artistic
- Abstract and creative (avoid literal music instruments unless they fit the theme)
- Capture the mood, energy, and aesthetic of the music
- Include colors, atmosphere, and visual elements that match the genre/mood
- Be suitable for AI image generation
- Maximum 200 characters to keep it focused
- NEVER include text, letters, words, or typography in the image
- Focus on pure visual elements like colors, shapes, patterns, and atmosphere

Guidelines by genre/mood:
- Rock/Metal: Dark colors, dramatic lighting, urban/industrial elements, NO TEXT
- Electronic/Synthwave: Neon colors, geometric shapes, futuristic elements, NO TEXT
- Jazz: Warm colors, smooth gradients, elegant compositions, NO TEXT
- Classical: Elegant, refined, possibly architectural elements, NO TEXT
- Hip-Hop: Urban, street art style, bold colors, dynamic composition, NO TEXT
- Country: Natural landscapes, warm earth tones, NO TEXT
- Pop: Bright, colorful, energetic, NO TEXT
- Ambient/Chill: Soft gradients, peaceful, ethereal, NO TEXT
- Workout/Energetic: Dynamic, bold, high contrast, NO TEXT

Time-based moods:
- Morning: Warm sunrise colors, fresh, bright
- Evening: Sunset colors, warm and cozy
- Night: Dark blues, purples, mysterious
- Late Night: Deep colors, moody, atmospheric

Weather integration:
- Sunny: Bright, warm colors, light and airy
- Rainy: Cool blues, grays, atmospheric
- Snowy: Cool whites, blues, crystalline
- Stormy: Dark, dramatic, high contrast

IMPORTANT: Do not include any text, letters, words, or written elements in the image. Focus only on visual aesthetics, colors, patterns, and abstract designs.

Format your response as just the image prompt, nothing else:`;

    console.log("Generating playlist image prompt with AI...");
    
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
          temperature: 0.9, // High creativity for visual descriptions
          max_tokens: 150
        }
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Image prompt API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    
    // Clean up the response
    let imagePrompt = data.response.trim();
    
    // Remove any extra formatting or explanations
    imagePrompt = imagePrompt.replace(/^(Image prompt:|Prompt:|Visual description:)/i, '').trim();
    imagePrompt = imagePrompt.replace(/^["']|["']$/g, '').trim();
    
    // Remove any text-related words to ensure no text appears in the image
    const textWords = ['text', 'letters', 'words', 'typography', 'font', 'writing', 'title', 'label', 'sign'];
    textWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      imagePrompt = imagePrompt.replace(regex, '');
    });
    
    // Add explicit no-text instruction
    if (!imagePrompt.toLowerCase().includes('no text')) {
      imagePrompt += ', no text, no letters, no words';
    }
    
    // Ensure it's not too long
    if (imagePrompt.length > 200) {
      imagePrompt = imagePrompt.substring(0, 190) + ', no text';
    }
    
    // Fallback if prompt is too short or empty
    if (!imagePrompt || imagePrompt.length < 10) {
      console.log("Generated prompt too short, using fallback");
      imagePrompt = generateFallbackImagePrompt(userOptions);
    }
    
    console.log(`Generated image prompt: "${imagePrompt}"`);
    
    return imagePrompt;
    
  } catch (error) {
    console.error("Error generating playlist image prompt:", error);
    
    // Fallback to simple but effective prompts
    return generateFallbackImagePrompt(userOptions);
  }
}

function generateFallbackImagePrompt(userOptions: UserOptions): string {
  const prompts = [];
  
  // Base style
  let baseStyle = "abstract digital art, vibrant colors, artistic composition, no text, no letters";
  
  // Genre-based prompts
  if (userOptions.genre) {
    switch (userOptions.genre.toLowerCase()) {
      case 'rock':
        prompts.push("dark urban landscape with dramatic lighting and bold geometric shapes, no text");
        break;
      case 'electronic':
        prompts.push("neon cyberpunk aesthetic with geometric patterns and glowing elements, no text");
        break;
      case 'jazz':
        prompts.push("warm golden tones with smooth flowing curves and elegant composition, no text");
        break;
      case 'classical':
        prompts.push("refined elegant design with architectural elements and soft lighting, no text");
        break;
      case 'hip-hop':
        prompts.push("urban street art style with bold colors and dynamic composition, no text");
        break;
      case 'country':
        prompts.push("natural landscape with warm earth tones and rustic elements, no text");
        break;
      case 'pop':
        prompts.push("bright colorful design with energetic patterns and modern aesthetic, no text");
        break;
      default:
        prompts.push("modern abstract design with dynamic colors, no text");
    }
  }
  
  // Mood-based additions
  if (userOptions.mood) {
    switch (userOptions.mood.toLowerCase()) {
      case 'energetic':
        prompts.push("high contrast, dynamic movement, explosive energy");
        break;
      case 'chill':
        prompts.push("soft gradients, peaceful atmosphere, flowing forms");
        break;
      case 'melancholic':
        prompts.push("muted colors, contemplative mood, gentle shadows");
        break;
      case 'happy':
        prompts.push("bright vibrant colors, uplifting composition, radiant lighting");
        break;
      case 'dark':
        prompts.push("deep shadows, mysterious atmosphere, dramatic contrast");
        break;
    }
  }
  
  // Time-based elements
  if (userOptions.timeOfDay) {
    switch (userOptions.timeOfDay.toLowerCase()) {
      case 'morning':
        prompts.push("warm sunrise colors, fresh bright atmosphere");
        break;
      case 'evening':
        prompts.push("golden hour lighting, warm cozy tones");
        break;
      case 'night':
        prompts.push("deep blues and purples, starlit atmosphere");
        break;
      case 'late night':
        prompts.push("dark moody colors, intimate lighting");
        break;
    }
  }
  
  // Weather elements
  if (userOptions.weather) {
    switch (userOptions.weather.toLowerCase()) {
      case 'sunny':
        prompts.push("bright radiant lighting, warm golden tones");
        break;
      case 'rainy':
        prompts.push("cool blues and grays, atmospheric mist");
        break;
      case 'snowy':
        prompts.push("crystalline whites and cool blues, pristine atmosphere");
        break;
      case 'stormy':
        prompts.push("dramatic dark clouds, electrical energy, high contrast");
        break;
    }
  }
  
  // Combine elements
  const combinedPrompt = prompts.length > 0 
    ? `${baseStyle}, ${prompts.join(', ')}, no text, no letters, no words`
    : `${baseStyle}, modern music-inspired design with dynamic colors and artistic flair, no text, no letters`;
  
  // Ensure it's not too long
  return combinedPrompt.length > 200 
    ? combinedPrompt.substring(0, 190) + ', no text'
    : combinedPrompt;
}