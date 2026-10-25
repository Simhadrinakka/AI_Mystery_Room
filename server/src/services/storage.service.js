import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
export async function saveImage(buffer, name, mime = 'image/png') {
  const safe = `${name.replace(/[^a-z0-9_-]/gi, '-')}-${Date.now()}.${mime.includes('svg') ? 'svg' : 'png'}`;
  if (env.NODE_ENV === 'production') {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const upload = bucket.openUploadStream(safe, { metadata: { contentType: mime } });
    await new Promise((resolve, reject) => {
      upload.once('finish', resolve);
      upload.once('error', reject);
      Readable.from(buffer).pipe(upload);
    });
    return `/uploads/gfs-${upload.id.toString()}`;
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safe), buffer);
  return `/uploads/${safe}`;
}
export async function deleteStoredImages(caseDocument) {
  const urls = [];
  for (const item of caseDocument.evidence || []) {
    if (item.payload?.imageUrl) urls.push(item.payload.imageUrl);
    for (const frame of item.payload?.frames || []) if (frame.imageUrl) urls.push(frame.imageUrl);
  }
  for (const url of new Set(urls)) {
    const gridfs = url.match(/^\/uploads\/gfs-([a-f\d]{24})$/i);
    if (gridfs && mongoose.connection.db) {
      try { await new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' }).delete(new mongoose.mongo.ObjectId(gridfs[1])); } catch {}
      continue;
    }
    const local = url.match(/^\/uploads\/([a-z\d_-]+\.(?:png|svg))$/i);
    if (local) try { await fs.unlink(path.join(dir, local[1])); } catch {}
  }
}
export function placeholderSvg(caption) { const label = String(caption).replace(/[<>&"']/g, '').slice(0, 90); return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="100%" height="100%" fill="#26241e"/><path d="M0 460L240 220l120 140 130-100 410 340H0z" fill="#39362d"/><text x="50%" y="90%" fill="#efb45c" font-family="sans-serif" font-size="24" text-anchor="middle">${label}</text></svg>`); }
