export function calculateScore({ isCorrect, difficulty, hintsUsed = 0, decisiveEvidenceIds = [], viewedEvidenceIds = [] }) {
  if (!isCorrect) return 0;
  const evidenceIds = new Set(decisiveEvidenceIds);
  const viewed = [...new Set(viewedEvidenceIds)].filter(id => evidenceIds.has(id)).length;
  const evidenceBonus = evidenceIds.size ? Math.round(viewed / evidenceIds.size * 20) : 0;
  const modifier = difficulty === 'hard' ? 20 : difficulty === 'medium' ? 10 : 0;
  return Math.min(150, Math.max(0, 100 - 10 * hintsUsed + modifier + evidenceBonus));
}
