import type { Context } from 'hono';
import { GoogleGenAI, Type } from '@google/genai';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);
  const { topSellers } = await c.req.json();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze these products and suggest a campaign for Quirkify. Return JSON with: title, description, featuredProductIds, strategy. Products: ${JSON.stringify(topSellers)}`,
    config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, featuredProductIds: { type: Type.ARRAY, items: { type: Type.STRING } }, strategy: { type: Type.STRING } }, required: ['title', 'description', 'featuredProductIds', 'strategy'] } }
  });
  return c.json(JSON.parse(response.text));
};
