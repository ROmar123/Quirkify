import type { Context } from 'hono';
import { GoogleGenAI, Type } from '@google/genai';

export default async (c: Context) => {
  const { productId } = c.req.query();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 3-5 talking points for a live stream host presenting product ${productId} on Quirkify. Return JSON array of {title, detail, stat}.`,
    config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, detail: { type: Type.STRING }, stat: { type: Type.STRING } }, required: ['title', 'detail', 'stat'] } } }
  });
  return c.json(JSON.parse(response.text));
};
