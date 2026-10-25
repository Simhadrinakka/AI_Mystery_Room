import { z } from 'zod';
export const registerSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(8).max(100) });
export const loginSchema = z.object({ email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(1) });
export const createCaseSchema = z.object({ scenario: z.string().trim().min(20).max(600), difficulty: z.enum(['easy','medium','hard']).default('medium'), tone: z.enum(['realistic','noir','cozy','thriller']).default('realistic') });
export const notesSchema = z.object({ notes: z.string().max(10000).optional().default(''), pinnedEvidenceIds: z.array(z.string()).max(30).optional() });
export const accuseSchema = z.object({ suspectId: z.string(), reasoning: z.string().trim().min(10).max(500) });
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
