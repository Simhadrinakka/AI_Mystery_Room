import Case from '../models/Case.js';
import { generateText } from './gemini.service.js';
import { biblePrompt } from '../prompts/bible.prompt.js';
import { evidencePlanPrompt } from '../prompts/evidencePlan.prompt.js';
import { evidencePrompt } from '../prompts/evidence.prompt.js';
import { consistencyPrompt } from '../prompts/consistency.prompt.js';
import { generateImage } from './gemini.service.js';
import { placeholderSvg, saveImage } from './storage.service.js';
import { bibleSchema, consistencySchema, evidencePlanSchema, chatPayloadSchema, imagePayloadSchema, cctvPayloadSchema, documentPayloadSchema } from '../schemas/generation.schemas.js';
import { env } from '../config/env.js';
const stages = async (id, stage, percent, message) => Case.updateOne({ _id: id }, { $set: { generationProgress: { stage, percent, message } } });
async function retryJson(prompt, validate = x => x) {
  let error;
  for (let i = 0; i < 3; i++) try { return validate(await generateText(`${prompt}${error ? `\nValidation issue: ${error}` : ''}`)); } catch (e) { error = e.message; }
  throw new Error(error || 'Generation validation failed');
}
export async function generateCase(caseId) {
  try {
    const c = await Case.findById(caseId); if (!c) return;
    await stages(caseId, 'case_bible', 8, 'Inventing suspects and establishing the truth');
    const bible = await retryJson(biblePrompt({ scenario: c.scenarioInput, difficulty: c.difficulty, tone: c.tone }), x => { const parsed = bibleSchema.parse(x); const expected = c.difficulty === 'easy' ? 4 : c.difficulty === 'hard' ? 6 : 5; if (parsed.suspects.length !== expected || !parsed.suspects.some(s => s.id === parsed.culprit.suspectId)) throw new Error('Invalid suspect count or culprit reference'); return parsed; });
    await stages(caseId, 'evidence_plan', 24, 'Planting clues across the evidence');
    const plan = await retryJson(evidencePlanPrompt({ bible, difficulty: c.difficulty }), x => {
      const parsed = evidencePlanSchema.parse(x);
      const expected = c.difficulty === 'easy' ? { chat: 2, image: 2, cctv: 1, document: 1 } : c.difficulty === 'hard' ? { chat: 4, image: 4, cctv: 2, document: 3 } : { chat: 3, image: 3, cctv: 2, document: 2 };
      if (Object.entries(expected).some(([type, count]) => parsed.filter(item => item.type === type).length !== count)) throw new Error('Evidence counts do not match the selected difficulty');
      if (parsed.filter(item => !item.isRedHerring && item.incriminates === bible.culprit.suspectId).length < 2) throw new Error('At least two direct clues must expose the culprit');
      return parsed;
    });
    await stages(caseId, 'evidence_generation', 40, 'Developing photos and assembling records');
    const evidence = new Array(plan.length); let cursor = 0;
    async function worker() { while (true) { const index = cursor++; if (index >= plan.length) return; const item = plan[index];
      const payload = await retryJson(evidencePrompt({ item, bible }), detail => ({ chat: chatPayloadSchema, image: imagePayloadSchema, cctv: cctvPayloadSchema, document: documentPayloadSchema })[item.type].parse(detail.payload || detail));
      if (item.type === 'image') {
        try { const buffer = await generateImage(detail.prompt || payload.prompt, { aspectRatio: '4:3' }); payload.imageUrl = await saveImage(buffer, item.id); payload.imageFallback = false; }
        catch { payload.imageUrl = await saveImage(placeholderSvg(detail.caption || item.title), item.id, 'image/svg+xml'); payload.imageFallback = true; }
      }
      if (item.type === 'cctv' && Array.isArray(payload.frames)) for (const [i, frame] of payload.frames.entries()) {
        try { frame.imageUrl = await saveImage(await generateImage(frame.prompt, { aspectRatio: '16:9' }), `${item.id}-${i}`); }
        catch { frame.imageUrl = await saveImage(placeholderSvg(frame.caption), `${item.id}-${i}`, 'image/svg+xml'); }
      }
      evidence[index] = { id: item.id, type: item.type, title: item.title, description: item.purpose, timestamp: item.timestamp, discovered: false, payload, _plan: item };
    } }
    await Promise.all(Array.from({ length: Math.min(Math.max(1, env.IMAGE_CONCURRENCY), plan.length) }, worker));
    await stages(caseId, 'consistency_check', 82, 'Reviewing CCTV and checking every clue');
    try { const check = await retryJson(consistencyPrompt({ bible, evidence: evidence.map(({ _plan, ...item }) => item) }), x => consistencySchema.parse(x)); if (!check.consistent) console.warn('Case consistency warning', caseId, check.issues); } catch (e) { console.warn('Consistency check skipped', caseId, e.message); }
    await stages(caseId, 'finalize', 95, 'Preparing the case room');
    const countByType = { chat: 0, image: 0, cctv: 0, document: 0 };
    const publicEvidence = evidence.map(({ _plan, ...item }) => { countByType[item.type]++; return item; });
    const expectedCounts = c.difficulty === 'easy' ? { chat: 2, image: 2, cctv: 1, document: 1 } : c.difficulty === 'hard' ? { chat: 4, image: 4, cctv: 2, document: 3 } : { chat: 3, image: 3, cctv: 2, document: 2 };
    if (Object.keys(expectedCounts).some(type => countByType[type] !== expectedCounts[type])) throw new Error('Evidence type counts do not match difficulty');
    if (evidence.filter(e => !e._plan.isRedHerring && e._plan.incriminates === bible.culprit.suspectId).length < 2) throw new Error('Evidence plan does not provide enough decisive clues');
    const culprit = bible.culprit;
    await Case.updateOne({ _id: caseId }, { $set: {
      status: 'ready', generationProgress: { stage: 'ready', percent: 100, message: 'Case ready' }, title: bible.title,
      briefing: bible.briefing || bible.incident?.description, setting: bible.setting, incidentSummary: bible.incident?.description,
      suspects: bible.suspects.map(s => ({ id: s.id, name: s.name, age: s.age, role: s.role, relationToVictim: s.relationToVictim, publicBio: s.publicBio, statedAlibi: s.alibi })), evidence: publicEvidence,
      solution: { culpritSuspectId: culprit.suspectId, motive: culprit.motive, method: culprit.method, mistakes: culprit.mistakes, fullTimeline: bible.timeline, redHerrings: bible.redHerrings,
        evidenceClueMap: evidence.map(e => ({ evidenceId: e.id, clueRevealed: e._plan.clueRevealed, incriminates: e._plan.incriminates, isRedHerring: e._plan.isRedHerring })), suspectSecrets: bible.suspects.map(s => ({ suspectId: s.id, secret: s.secret, alibiIsTrue: s.alibiIsTrue })) }
    } });
  } catch (error) {
    console.error('Case generation failed', { caseId, message: error.message });
    await Case.updateOne({ _id: caseId }, { $set: { status: 'failed', errorMessage: error.message, generationProgress: { stage: 'failed', percent: 100, message: 'Case generation failed' } } });
  }
}
