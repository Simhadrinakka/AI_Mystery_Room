export function toPublicCase(doc) {
  const c = doc.toObject ? doc.toObject() : doc;
  const { _id, title, briefing, setting, incidentSummary, suspects, evidence, difficulty, tone, status, generationProgress, errorMessage, notes, pinnedEvidenceIds, viewedEvidenceIds, hintsUsed, accusation, createdAt, updatedAt } = c;
  const result = { id: String(_id), title, briefing, setting, incidentSummary, suspects, evidence, difficulty, tone, status, generationProgress, errorMessage, notes, pinnedEvidenceIds, viewedEvidenceIds, hintsUsed, createdAt, updatedAt };
  if (accusation?.submittedAt) result.accusation = { submittedAt: accusation.submittedAt, score: accusation.score };
  if (c.status === 'solved' && c.verdict) result.verdict = c.verdict;
  return result;
}
