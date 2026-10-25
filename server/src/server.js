import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import Case from './models/Case.js';
await connectDB();
await Case.updateMany({ status: 'generating', updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) } }, { $set: { status: 'failed', errorMessage: 'Generation stopped unexpectedly. Please retry.', generationProgress: { stage: 'failed', percent: 100, message: 'Generation timed out' } } });
app.listen(env.PORT, () => console.info(`AI Mystery Room API listening on ${env.PORT}`));
