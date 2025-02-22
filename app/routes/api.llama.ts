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
    let prompt = "Suggest me some songs similar to 'Shape of You' by Ed Sheeran";
    
    // Check content type to handle different request formats
    const contentType = request.headers.get("Content-Type") || "";
    
    if (contentType.includes("application/json")) {
      // Handle JSON payload
      const jsonData = await request.json();
      prompt = jsonData.prompt || prompt;
      console.log("Received JSON prompt:", prompt);
    } else if (contentType.includes("application/x-www-form-urlencoded") || 
               contentType.includes("multipart/form-data")) {
      try {
        // Handle form data
        const formData = await request.formData();
        const formPrompt = formData.get("prompt");
        if (formPrompt) {
          prompt = formPrompt.toString();
        }
        console.log("Received form prompt:", prompt);
      } catch (formError) {
        console.error("Error parsing form data:", formError);
      }
    } else {
      console.log("Using default prompt, Content-Type was:", contentType);
    }
    
    const response = await callLlama(prompt);
    console.log("Returning API response:", response);
    return json(response);
  } catch (error) {
    console.error("API action error:", error);
    return json({ error: (error instanceof Error) ? error.message : String(error) });
  }
}