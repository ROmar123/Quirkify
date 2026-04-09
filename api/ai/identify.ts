import type { Context } from 'hono';
import { GoogleGenAI, Type } from '@google/genai';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);
  
  const { base64Image } = await c.req.json();
  if (!base64Image) return c.json({ error: 'No image provided' }, 400);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await Promise.race([
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { text: 'Identify this product for Quirkify, a gamified social commerce platform. Provide: name, description, category (one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other), retailPrice in ZAR, rarity (Common/Limited/Rare/Super Rare/Unique), stats (quirkiness/rarity/utility/hype 1-100 each), confidenceScore 0-1. Return JSON.' },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
        ]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            priceRange: { type: Type.OBJECT, properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } } },
            retailPrice: { type: Type.NUMBER },
            rarity: { type: Type.STRING },
            stats: { type: Type.OBJECT, properties: { quirkiness: { type: Type.NUMBER }, rarity: { type: Type.NUMBER }, utility: { type: Type.NUMBER }, hype: { type: Type.NUMBER } } },
            confidenceScore: { type: Type.NUMBER }
          },
          required: ['name', 'description', 'category', 'retailPrice', 'rarity', 'stats', 'confidenceScore']
        }
      }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 25000)
  ]) as any;

  return c.json(JSON.parse(response.text));
};
