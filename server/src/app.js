import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import caseRoutes from './routes/case.routes.js';
import demoRoutes from './routes/demo.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
const app = express();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'] } }
}));
if (env.NODE_ENV !== 'production') app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' })); app.use(cookieParser()); app.use(mongoSanitize());
app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d', immutable: false }));
app.get('/uploads/gfs-:fileId', async (req, res, next) => {
  try {
    const ObjectId = mongoose.mongo.ObjectId;
    if (!ObjectId.isValid(req.params.fileId)) return res.sendStatus(404);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const file = await bucket.find({ _id: new ObjectId(req.params.fileId) }).next();
    if (!file) return res.sendStatus(404);
    res.set('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    const stream = bucket.openDownloadStream(file._id);
    stream.on('error', error => { if (!res.headersSent) res.sendStatus(404); else res.destroy(error); });
    stream.pipe(res);
  } catch (error) { next(error); }
});
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/v1/cases', caseRoutes); app.use('/api/v1/demo-case', demoRoutes);
app.use('/api', notFound);
const clientDist = path.join(rootDir, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), error => { if (error) next(error); });
});
app.use(notFound); app.use(errorHandler);
export default app;
