import fs from "node:fs";
import axios, { AxiosResponse } from "axios";
import FormData from "form-data";
import { STABILITY_API_KEY } from "~/utils/envExports";

interface ImageGenerationPayload {
  prompt: string;
  output_format: "webp" | "jpeg" | "png";
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

// Usage
const payload: ImageGenerationPayload = {
  prompt: "Pepe cliff",
  output_format: "webp"
};

const config: StabilityAIConfig = {
  apiKey: STABILITY_API_KEY,
  outputPath: "./lighthouse.webp"
};

generateImage(payload, config);