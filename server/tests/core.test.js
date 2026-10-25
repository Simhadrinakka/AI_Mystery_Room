import { calculateScore } from '../src/services/scoring.service.js';
import { bibleSchema, evidencePlanSchema } from '../src/schemas/generation.schemas.js';
import { toPublicCase } from '../src/utils/serializers.js';

describe('scoring', () => {
  test('correct scores apply hints, difficulty and viewed evidence modifiers', () => {
    expect(calculateScore({ isCorrect: true, difficulty: 'hard', hintsUsed: 1, decisiveEvidenceIds: ['e1','e2'], viewedEvidenceIds: ['e1','e2'] })).toBe(130);
  });
  test('wrong accusations score zero', () => {
    expect(calculateScore({ isCorrect: false, difficulty: 'hard', decisiveEvidenceIds: ['e1'] })).toBe(0);
  });
  test('score is clamped at zero after hints', () => {
    expect(calculateScore({ isCorrect: true, difficulty: 'easy', hintsUsed: 3 })).toBe(70);
  });
});

describe('generation output schemas', () => {
  test('rejects a bible without the required culprit mistakes', () => {
    expect(() => bibleSchema.parse({ culprit: { suspectId: 's1', motive: 'x', method: 'y', mistakes: [] } })).toThrow();
  });
  test('rejects an unknown evidence type', () => {
    expect(() => evidencePlanSchema.parse([{ id:'e1', type:'video', title:'x', purpose:'x', supportsSuspectIds:[], incriminates:null, isRedHerring:false, timestamp:'2026-01-01', clueRevealed:'x' }])).toThrow();
  });
});

describe('public case serializer', () => {
  test('never serializes the hidden solution, even after it is selected internally', () => {
    const json = JSON.stringify(toPublicCase({ _id:'case1', title:'Demo', status:'ready', suspects:[{id:'s1',name:'Person'}], solution:{ culpritSuspectId:'s1', motive:'secret' } }));
    expect(json).not.toContain('solution');
    expect(json).not.toContain('culpritSuspectId');
    expect(json).toContain('Person');
  });
});
