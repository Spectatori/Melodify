import { json } from "@remix-run/node";
import fetch from "node-fetch";

export async function callLlama(prompt: string) {
  console.log("callLlama function called with prompt:", prompt);
  try {
    // Make sure Ollama is running and accessible
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: prompt,
        stream: false,
      }),
    });

    console.log("Ollama API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error response:", errorText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Ollama API successful response received");
    return { content: data.response };
  } catch (error) {
    console.error("Llama API error:", error);
    throw error;
  }
}

import type { ActionFunction } from "@remix-run/node";

export const action: ActionFunction = async ({ request }) => {
  console.log("Llama API action function called");
  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt")?.toString() || "Suggest me some songs similar to 'Shape of You' by Ed Sheeran";
    
    console.log("Received prompt:", prompt);
    
    const response = await callLlama(prompt);
    console.log("Returning API response:", response);
    return json(response);
  } catch (error) {
    console.error("API action error:", error);
    return json({ error: (error instanceof Error) ? error.message : String(error) });
  }
}