import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
export async function saveImage(buffer, name, mime = 'image/png') {
  await fs.mkdir(dir, { recursive: true });
  const safe = `${name.replace(/[^a-z0-9_-]/gi, '-')}-${Date.now()}.${mime.includes('svg') ? 'svg' : 'png'}`;
  await fs.writeFile(path.join(dir, safe), buffer);
  return `/uploads/${safe}`;
}
export function placeholderSvg(caption) { const label = String(caption).replace(/[<>&"']/g, '').slice(0, 90); return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="100%" height="100%" fill="#26241e"/><path d="M0 460L240 220l120 140 130-100 410 340H0z" fill="#39362d"/><text x="50%" y="90%" fill="#efb45c" font-family="sans-serif" font-size="24" text-anchor="middle">${label}</text></svg>`); }
