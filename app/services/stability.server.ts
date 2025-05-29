// New function to generate playlist cover art
export async function generatePlaylistCoverArt(
  playlistId: string,
  imagePrompt: string
): Promise<string> {
  try {
    const outputPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
    
    // Ensure the prompt explicitly forbids text
    const noTextPrompt = imagePrompt.includes('no text') 
      ? imagePrompt 
      : `${imagePrompt}, no text, no letters, no words, abstract visual design only`;
    
    const payload: ImageGenerationPayload = {
      prompt: noTextPrompt,
      output_format: "jpeg",
      aspect_ratio: "1:1", // Square format for playlist covers
      style_preset: "digital-art" // Valid style preset - good for abstract designs
    };

    const config: StabilityAIConfig = {
      apiKey: STABILITY_API_KEY,
      outputPath: outputPath
    };

    await generateImage(payload, config);
    
    // Return the public URL path
    return `/playlist-covers/${playlistId}.jpg`;
  } catch (error) {
    console.error("Error generating playlist cover art:", error);
    throw error;
  }
}import fs from "node:fs";
import path from "node:path";
import axios, { AxiosResponse } from "axios";
import FormData from "form-data";
import { STABILITY_API_KEY } from "~/utils/envExports";

interface ImageGenerationPayload {
  prompt: string;
  output_format: "webp" | "jpeg" | "png";
  aspect_ratio?: string;
  style_preset?: string;
}

interface StabilityAIConfig {
  apiKey: string;
  outputPath: string;
}

const generateImage = async (
  payload: ImageGenerationPayload,
  config: StabilityAIConfig
): Promise<void> => {
  try {
    const response: AxiosResponse<ArrayBuffer> = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/core`,
      axios.toFormData(payload, new FormData()),
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: { 
          Authorization: `Bearer ${config.apiKey}`, 
          Accept: "image/*" 
        },
      },
    );

    if (response.status === 200) {
      // Ensure the directory exists
      const dir = path.dirname(config.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(config.outputPath, Buffer.from(response.data));
      console.log(`Image saved successfully to ${config.outputPath}`);
    } else {
      throw new Error(`${response.status}: ${response.data.toString()}`); 
    }
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

// Function to check if playlist cover already exists
export function playlistCoverExists(playlistId: string): boolean {
  const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
  const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
  return fs.existsSync(jpegPath) || fs.existsSync(webpPath);
}

// Function to get playlist cover URL
export function getPlaylistCoverUrl(playlistId: string): string | null {
  const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
  const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
  
  if (fs.existsSync(jpegPath)) {
    return `/playlist-covers/${playlistId}.jpg`;
  }
  if (fs.existsSync(webpPath)) {
    return `/playlist-covers/${playlistId}.webp`;
  }
  return null;
}