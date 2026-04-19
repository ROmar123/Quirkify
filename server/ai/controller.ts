import { GoogleGenAI, Type } from "@google/genai";
import type { Product } from "../../src/types";

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required for AI features.");
}

const ai = new GoogleGenAI({ apiKey });

export async function identifyProduct(base64Image: string) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI analysis timed out after 30 seconds. Please try again.")), 30000)
  );

  const analyzePromise = ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [
      {
        parts: [
          {
            text: "Identify this product for Quirkify, a gamified social commerce platform. Provide a name, a detailed description, a suggested category (must be one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other), and an estimated price range in ZAR (South African Rand) specifically for the Cape Town market. Also assign a Rarity (Common, Limited, Rare, Super Rare, Unique) and four stats (quirkiness, rarity, utility, hype) from 1 to 100 based on the product's appeal. Provide a confidence score from 0 to 1.",
          },
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
        ],
      },
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
              max: { type: Type.NUMBER },
            },
            required: ["min", "max"],
          },
          retailPrice: { type: Type.NUMBER, description: "Estimated current retail price in ZAR" },
          rarity: { type: Type.STRING, description: "Common, Limited, Rare, Super Rare, Unique" },
          stats: {
            type: Type.OBJECT,
            properties: {
              quirkiness: { type: Type.NUMBER },
              rarity: { type: Type.NUMBER },
              utility: { type: Type.NUMBER },
              hype: { type: Type.NUMBER },
            },
            required: ["quirkiness", "rarity", "utility", "hype"],
          },
          confidenceScore: { type: Type.NUMBER },
          alternatives: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["name", "description", "category", "priceRange", "rarity", "stats", "confidenceScore"],
      },
    },
  });

  const response = await Promise.race([analyzePromise, timeoutPromise]);
  return JSON.parse(response.text);
}

export async function suggestCampaign(topSellers: any[]) {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
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
            items: { type: Type.STRING },
          },
          strategy: { type: Type.STRING },
        },
        required: ["title", "description", "featuredProductIds", "strategy"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getHostTalkingPoints(product: Product) {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `You are an AI assistant for a live stream host on Quirkify. Generate 3 engaging talking points for this product to help the host sell it.
    Product: ${JSON.stringify(product)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          talkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          hypePhrase: { type: Type.STRING },
        },
        required: ["talkingPoints", "hypePhrase"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getPersonalizedRecommendations(products: Product[], userInterests: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `Based on the user's interests: ${userInterests.join(", ")}, select the top 3 most relevant products from this list for Quirkify.
    Products: ${JSON.stringify(products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
    })))}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: ["recommendedIds", "reasoning"],
      },
    },
  });

  return JSON.parse(response.text);
}
