import type { Context } from 'hono';
import { GoogleGenAI, Type } from '@google/genai';

export default async (c: Context) => {
  const { userId } = c.req.query();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate personalized product recommendations for user ${userId} on Quirkify. Return JSON: {recommendedProducts: [{id, name, reason}]}`,
    config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { recommendedProducts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, reason: { type: Type.STRING } } } } }, required: ['recommendedProducts'] } }
  });
  return c.json(JSON.parse(response.text));
};
