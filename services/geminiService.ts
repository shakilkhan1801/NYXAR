import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export const initializeGemini = () => {
  // In a real production app, you would proxy this through your backend
  // to avoid exposing the key, or use a short-lived token.
  // For this "Client-Side" demo requirements, we use the env var if available.
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
};

export const generateAIResponse = async (prompt: string, history: string[]): Promise<string> => {
  if (!genAI) {
      // Fallback for demo if no key provided
      return new Promise(resolve => setTimeout(() => resolve("I am Nyxar AI. To enable my full intelligence, please configure the Gemini API Key in the environment."), 1000));
  }

  try {
    // Simple history construction for context
    const chat = genAI.chats.create({
        model: "gemini-2.5-flash-latest",
        history: history.map((msg, i) => ({
            role: i % 2 === 0 ? "user" : "model",
            parts: [{ text: msg }]
        }))
    });

    const result = await chat.sendMessage({ message: prompt });
    return result.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Secure connection to AI Core failed. Please try again later.";
  }
};