import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
const ai = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function generateText(prompt) {
  if (!ai) throw Object.assign(new Error('Gemini is not configured. Add GEMINI_API_KEY to server/.env.'), { code: 'AI_NOT_CONFIGURED', status: 503 });
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    try {
      const result = await Promise.race([ai.models.generateContent({ model: env.GEMINI_TEXT_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } }), new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timed out')), 60000))]);
      const usage = result.usageMetadata || {};
      if (env.NODE_ENV !== 'production') console.info('Gemini text call', { model: env.GEMINI_TEXT_MODEL, latencyMs: Date.now() - started, usage });
      return JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (error) { last = error; if (attempt < 2) await delay(attempt ? 3000 : 1000); }
  }
  throw last;
}
export async function generateImage(prompt, { aspectRatio = '4:3' } = {}) {
  if (!ai) throw new Error('Gemini image generation is not configured');
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await ai.interactions.create({ model: env.GEMINI_IMAGE_MODEL, input: prompt, response_format: { type: 'image', aspect_ratio: aspectRatio } });
      const image = result.outputs?.find(output => output.type === 'image' && output.data);
      const imageData = image?.data;
      if (!imageData) throw new Error('Image generation returned no image');
      return Buffer.from(imageData, 'base64');
    } catch (error) { last = error; if (attempt < 2) await delay(attempt ? 3000 : 1000); }
  }
  throw last;
}
export async function classifyScenario(scenario) {
  const data = await generateText(`Classify safety for fictional mystery scenario. Reject real named people, sexual content, minors in danger, self-harm, hate, instructions for real crimes. Return JSON {allowed:boolean,reason:string}. Scenario: ${scenario}`);
  return data;
}
