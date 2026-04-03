import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getPersonalizedRecommendations(products: Product[], userInterests: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the user's interests: ${userInterests.join(', ')}, select the top 3 most relevant products from this list for Quirkify.
    Products: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, category: p.category, description: p.description })))}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          reasoning: { type: Type.STRING }
        },
        required: ["recommendedIds", "reasoning"]
      }
    }
  });

  return JSON.parse(response.text);
}
