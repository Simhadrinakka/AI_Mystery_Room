import mongoose from 'mongoose';
const CaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, scenarioInput: String,
  difficulty: { type: String, enum: ['easy','medium','hard'], default: 'medium' }, tone: String,
  status: { type: String, enum: ['generating','ready','failed','solved','abandoned'], default: 'generating', index: true },
  generationProgress: { stage: String, percent: Number, message: String }, errorMessage: String,
  title: String, briefing: String, setting: { location: String, date: String, summary: String }, incidentSummary: String,
  suspects: [{ id: String, name: String, age: Number, role: String, relationToVictim: String, publicBio: String, statedAlibi: String, avatarUrl: String }],
  evidence: [{ id: String, type: String, title: String, description: String, timestamp: String, discovered: { type: Boolean, default: false }, payload: mongoose.Schema.Types.Mixed }],
  solution: { type: mongoose.Schema.Types.Mixed, select: false }, notes: { type: String, default: '' }, pinnedEvidenceIds: [String], viewedEvidenceIds: [String], hintsUsed: { type: Number, default: 0 },
  accusation: { suspectId: String, reasoning: String, submittedAt: Date, isCorrect: Boolean, score: Number },
  verdict: mongoose.Schema.Types.Mixed, isDemo: { type: Boolean, default: false }
}, { timestamps: true });
CaseSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('Case', CaseSchema);
