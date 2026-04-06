import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function identifyProduct(base64Image: string) {
  // Wrap with 30-second timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('AI analysis timed out after 30 seconds. Please try a different image.')), 30000)
  );

  const analyzePromise = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: "Identify this product for Quirkify, a gamified social commerce platform. Provide a name, a detailed description, a suggested category (must be one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other), and an estimated price range in ZAR (South African Rand) specifically for the Cape Town market. Also assign a Rarity (Common, Limited, Rare, Super Rare, Unique) and four stats (quirkiness, rarity, utility, hype) from 1 to 100 based on the product's appeal. Provide a confidence score from 0 to 1." },
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          priceRange: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER }
            },
            required: ["min", "max"]
          },
          retailPrice: { type: Type.NUMBER, description: "The estimated current retail price in ZAR" },
          rarity: { type: Type.STRING, description: "Common, Limited, Rare, Super Rare, Unique" },
          stats: {
            type: Type.OBJECT,
            properties: {
              quirkiness: { type: Type.NUMBER },
              rarity: { type: Type.NUMBER },
              utility: { type: Type.NUMBER },
              hype: { type: Type.NUMBER }
            },
            required: ["quirkiness", "rarity", "utility", "hype"]
          },
          confidenceScore: { type: Type.NUMBER },
          alternatives: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["name", "description", "category", "priceRange", "rarity", "stats", "confidenceScore"]
      }
    }
  });

  const response = await Promise.race([analyzePromise, timeoutPromise]) as any;
  return JSON.parse(response.text);
}

export async function suggestCampaign(topSellers: any[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze these top selling products and suggest a marketing campaign strategy for Aura Commerce. Include a title, description, and which products to feature.
    Products: ${JSON.stringify(topSellers)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          featuredProductIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          strategy: { type: Type.STRING }
        },
        required: ["title", "description", "featuredProductIds", "strategy"]
      }
    }
  });

  return JSON.parse(response.text);
}
