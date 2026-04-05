import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ProductAnalysis {
  name: string;
  description: string;
  category: string;
  priceRange: { min: number; max: number };
  retailPrice: number;
  rarity: string;
  stats: { quirkiness: number; rarity: number; utility: number; hype: number };
  confidenceScore: number;
  alternatives: string[];
}

export async function identifyProduct(base64Image: string): Promise<ProductAnalysis> {
  // Wrap with 45-second timeout for better reliability
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Image analysis took too long. Try a clearer photo.')), 45000)
  );

  try {
    const analyzePromise = (async (): Promise<ProductAnalysis> => {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: "Identify this product for Quirkify, a social commerce platform. Return ONLY valid JSON with: name (string), description (string, detailed), category (one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other), priceRange (object with min and max in ZAR), retailPrice (number in ZAR), rarity (Common/Limited/Rare/Super Rare/Unique), stats (object with quirkiness, rarity, utility, hype as 1-100 numbers), confidenceScore (0-1). Be accurate with pricing for Cape Town market." },
                { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
              ]
            }
          ]
        });

        // Handle both structured output and text response formats
        const responseText = (response as any).text ? (response as any).text() :
                            (response as any).candidates?.[0]?.content?.parts?.[0]?.text ||
                            JSON.stringify(response);

        // Parse JSON response
        const parsed = JSON.parse(responseText) as ProductAnalysis;

        // Ensure all required fields exist with safe defaults
        return {
          name: parsed.name || 'Unknown Product',
          description: parsed.description || 'No description available',
          category: parsed.category || 'Other',
          priceRange: parsed.priceRange || { min: 0, max: 0 },
          retailPrice: parsed.retailPrice || parsed.priceRange?.max || 0,
          rarity: parsed.rarity || 'Common',
          stats: parsed.stats || { quirkiness: 50, rarity: 50, utility: 50, hype: 50 },
          confidenceScore: Math.min(1, Math.max(0, parsed.confidenceScore || 0.7)),
          alternatives: parsed.alternatives || []
        };
      } catch (innerErr) {
        console.error('Gemini parsing error:', innerErr);
        throw new Error(`Failed to analyze image: ${(innerErr as any).message}`);
      }
    })();

    return await Promise.race([analyzePromise, timeoutPromise]) as ProductAnalysis;
  } catch (err) {
    console.error('Product identification error:', err);
    throw err;
  }
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
