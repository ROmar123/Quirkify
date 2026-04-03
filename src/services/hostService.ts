import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getHostTalkingPoints(product: Product) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an AI assistant for a live stream host on Quirkify. Generate 3 engaging talking points for this product to help the host sell it.
    Product: ${JSON.stringify(product)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          talkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          hypePhrase: { type: Type.STRING }
        },
        required: ["talkingPoints", "hypePhrase"]
      }
    }
  });

  return JSON.parse(response.text);
}
