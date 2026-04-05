import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function identifyProduct(base64Image: string) {
  console.log(`[Gemini] Starting product identification. Image size: ${base64Image.length} bytes`);

  // 60-second timeout for API call
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Analysis timed out after 60 seconds. Please try again.')), 60000)
  );

  const analyzePromise = (async () => {
    try {
      console.log('[Gemini] Calling API with base64 image...');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Identify this product. Return ONLY valid JSON with these EXACT fields:
{
  "name": "product name",
  "description": "2-3 sentence description",
  "category": "one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other",
  "priceRange": {"min": number, "max": number},
  "retailPrice": number,
  "rarity": "one of: Common, Limited, Rare, Super Rare, Unique",
  "stats": {"quirkiness": 1-100, "rarity": 1-100, "utility": 1-100, "hype": 1-100},
  "confidenceScore": 0-1,
  "alternatives": ["alternative1", "alternative2"]
}`
              },
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
              retailPrice: { type: Type.NUMBER },
              rarity: { type: Type.STRING },
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

      console.log('[Gemini] Received response object');

      // Extract text from response - handle both methods
      let textContent: string;

      if (typeof (response as any).text === 'function') {
        textContent = (response as any).text();
      } else if ((response as any).text) {
        textContent = (response as any).text;
      } else {
        console.error('[Gemini] Response structure:', JSON.stringify(response).substring(0, 500));
        throw new Error('Could not extract text from API response');
      }

      if (!textContent || textContent.length === 0) {
        throw new Error('API returned empty response');
      }

      console.log('[Gemini] Parsing JSON response...');
      const parsed = JSON.parse(textContent);

      // Validate all required fields exist
      const required = ['name', 'description', 'category', 'priceRange', 'rarity', 'stats', 'confidenceScore'];
      const missing = required.filter(field => !parsed[field]);

      if (missing.length > 0) {
        throw new Error(`Missing fields: ${missing.join(', ')}`);
      }

      console.log('[Gemini] Product identified successfully:', parsed.name);
      return parsed;

    } catch (err: any) {
      console.error('[Gemini] Inner error:', err.message);
      throw err;
    }
  })();

  try {
    const result = await Promise.race([analyzePromise, timeoutPromise]);
    console.log('[Gemini] Analysis complete, returning to AIIntake');
    return result;
  } catch (err: any) {
    console.error('[Gemini] Analysis failed:', err.message);
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
