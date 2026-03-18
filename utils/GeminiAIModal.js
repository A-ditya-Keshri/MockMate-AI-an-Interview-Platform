// utils/GeminiAIModal.js
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("🔴 FATAL ERROR: GEMINI_API_KEY environment variable is not defined. Check your .env.local file.");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Generate content using Gemini AI.
 * @param {string} prompt - The prompt to send to the model.
 * @returns {Promise<string>} - The generated text response.
 */
export async function generateContent(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text;
}