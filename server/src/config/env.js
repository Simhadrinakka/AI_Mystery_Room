import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const schema = z.object({
  PORT: z.coerce.number().default(5000), NODE_ENV: z.string().default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/ai-mystery-room'), JWT_SECRET: z.string().min(8).default('local-development-secret'),
  JWT_EXPIRES_IN: z.string().default('7d'), CLIENT_URL: z.string().url().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional(), GEMINI_TEXT_MODEL: z.string().default('gemini-3.8-flash'), GEMINI_IMAGE_MODEL: z.string().default('gemini-nano-banana-2.1'),
  IMAGE_CONCURRENCY: z.coerce.number().default(3), MAX_CASES_PER_HOUR: z.coerce.number().default(5)
});
export const env = schema.parse(process.env);
