import { z } from 'zod';
const id = z.string().min(1);
export const bibleSchema = z.object({
  title: z.string().min(1), briefing: z.string().optional(),
  setting: z.object({ location: z.string(), date: z.string(), summary: z.string() }),
  incident: z.object({ type: z.enum(['theft','murder','sabotage','disappearance','fraud','other']), description: z.string(), occurredAt: z.string() }),
  suspects: z.array(z.object({ id, name: z.string(), age: z.number(), role: z.string(), relationToVictim: z.string(), publicBio: z.string(), secret: z.string(), alibi: z.string(), alibiIsTrue: z.boolean(), appearancePrompt: z.string().optional() })),
  culprit: z.object({ suspectId: id, motive: z.string(), method: z.string(), mistakes: z.array(z.string()).min(2) }),
  timeline: z.array(z.object({ time: z.string(), event: z.string(), suspectIds: z.array(id), isPublic: z.boolean() })),
  redHerrings: z.array(z.object({ suspectId: id, description: z.string() }))
});
export const evidencePlanSchema = z.array(z.object({ id, type: z.enum(['chat','image','cctv','document']), title: z.string(), purpose: z.string(), supportsSuspectIds: z.array(id), incriminates: id.nullable(), isRedHerring: z.boolean(), timestamp: z.string(), clueRevealed: z.string() }));
export const consistencySchema = z.object({ consistent: z.boolean(), issues: z.array(z.string()) });
export const chatPayloadSchema = z.object({ platform: z.string(), participants: z.array(z.object({ suspectId: id, displayName: z.string() })), isGroup: z.boolean(), messages: z.array(z.object({ sender: id, text: z.string(), time: z.string(), status: z.string().optional(), deleted: z.boolean().optional(), edited: z.boolean().optional() })).min(12).max(30) });
export const imagePayloadSchema = z.object({ caption: z.string(), prompt: z.string(), exifLike: z.object({ takenAt: z.string(), location: z.string() }) });
export const cctvPayloadSchema = z.object({ cameraName: z.string(), location: z.string(), frames: z.array(z.object({ timestamp: z.string(), caption: z.string(), prompt: z.string() })).min(4).max(8), frameDurationMs: z.number().default(1500) });
export const documentPayloadSchema = z.object({ kind: z.enum(['receipt','email','note','log','report']), markdown: z.string() });
