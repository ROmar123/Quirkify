import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function identifyProduct(base64Image: string) {
  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Check GEMINI_API_KEY environment variable.');
  }

  // Log image size for debugging
  console.log(`[Gemini] Analyzing image, base64 size: ${base64Image.length} bytes`);

  // Wrap with 45-second timeout (API calls can be slow)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Analysis timed out. Server is busy. Try again in a moment.')), 45000)
  );

  const analyzePromise = (async () => {
    try {
      console.log('[Gemini] Starting API call...');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "You are a product identifier for Quirkify, a social commerce platform. Analyze this product image and return ONLY a valid JSON response (no markdown, no explanation). Required fields: name (product name), description (detailed 1-2 sentence description), category (one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other), priceRange (object with min and max in ZAR for Cape Town market), retailPrice (estimated retail price in ZAR), rarity (one of: Common, Limited, Rare, Super Rare, Unique), stats (object with quirkiness, rarity, utility, hype as numbers 1-100), confidenceScore (0-1)." },
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

      console.log('[Gemini] Got response:', response);

      // Handle response.text() as function or property
      const textContent = typeof (response as any).text === 'function'
        ? (response as any).text()
        : (response as any).text;

      if (!textContent) {
        console.error('[Gemini] No text content in response:', response);
        throw new Error('No text content in API response');
      }

      console.log('[Gemini] Text content:', textContent.substring(0, 200));

      const parsed = JSON.parse(textContent);
      console.log('[Gemini] Parsed JSON successfully');

      // Validate required fields
      if (!parsed.name || !parsed.description || !parsed.category) {
        throw new Error(`Missing required fields. Got: ${JSON.stringify(Object.keys(parsed))}`);
      }

      console.log('[Gemini] Validation passed, returning product data');
      return parsed;
    } catch (innerErr: any) {
      console.error('[Gemini] API error:', {
        message: innerErr.message,
        code: innerErr.code,
        status: innerErr.status,
        details: innerErr.details,
      });
      throw innerErr;
    }
  })();

  try {
    const response = await Promise.race([analyzePromise, timeoutPromise]) as any;
    return response;
  } catch (err: any) {
    console.error('[Gemini] Full error:', {
      message: err.message,
      name: err.name,
      status: err.status,
      code: err.code,
    });

    // Provide better error message based on error type
    if (err.message.includes('timed out')) {
      throw err;
    } else if (err.message.includes('API key')) {
      throw new Error('Server configuration error: API key missing');
    } else if (err.message.includes('401') || err.message.includes('403')) {
      throw new Error('Server authentication failed. Contact support.');
    } else if (err.message.includes('400')) {
      throw new Error('Invalid image format. Try a different photo.');
    } else if (err.message.includes('429')) {
      throw new Error('Too many requests. Wait a moment and try again.');
    } else if (err.message.includes('500') || err.message.includes('503')) {
      throw new Error('Gemini service is temporarily unavailable. Try again soon.');
    } else {
      throw err;
    }
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
