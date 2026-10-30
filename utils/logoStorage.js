import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', 'uploads');
export const logosDir = path.join(uploadsDir, 'logos');

const bucket = () => process.env.LOGO_S3_BUCKET || '';
const region = () => process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const useS3 = () => Boolean(bucket());

let s3;
function client() {
  if (!s3) s3 = new S3Client({ region: region() });
  return s3;
}

export function ensureUploadDirs() {
  if (useS3()) return;
  fs.mkdirSync(logosDir, { recursive: true });
}

export function publicLogoUrl(logoPath) {
  if (!logoPath) return '';
  if (useS3()) {
    const base = (process.env.LOGO_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (base) return `${base}/${logoPath.replace(/^\/+/, '')}`;
    return `https://${bucket()}.s3.${region()}.amazonaws.com/${logoPath.replace(/^\/+/, '')}`;
  }
  return `/uploads/${logoPath.replace(/^\/+/, '')}`;
}

export async function saveLogoFile({ buffer, originalName, mimetype }) {
  const ext = path.extname(originalName || '').toLowerCase() || '.png';
  const filename = `company-logo-${Date.now()}${ext}`;
  const key = `logos/${filename}`;

  if (useS3()) {
    await client().send(new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000',
    }));
    return key;
  }

  ensureUploadDirs();
  fs.writeFileSync(path.join(logosDir, filename), buffer);
  return key;
}

export async function deleteLogoFile(logoPath) {
  if (!logoPath) return;
  if (useS3()) {
    try {
      await client().send(new DeleteObjectCommand({
        Bucket: bucket(),
        Key: logoPath.replace(/^\/+/, ''),
      }));
    } catch {
      /* ignore */
    }
    return;
  }
  const full = path.join(uploadsDir, logoPath);
  if (full.startsWith(uploadsDir) && fs.existsSync(full)) {
    try { fs.unlinkSync(full); } catch { /* ignore */ }
  }
}

export async function getLogoBuffer(logoPath) {
  if (!logoPath) return null;

  if (useS3()) {
    try {
      const out = await client().send(new GetObjectCommand({
        Bucket: bucket(),
        Key: logoPath.replace(/^\/+/, ''),
      }));
      const bytes = await out.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      console.error('S3 logo fetch failed:', err.message);
      return null;
    }
  }

  const full = path.join(uploadsDir, logoPath);
  if (!full.startsWith(uploadsDir) || !fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}
