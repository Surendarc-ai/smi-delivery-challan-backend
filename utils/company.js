import Company from '../models/Company.js';
import { publicLogoUrl } from './logoStorage.js';

const ENV_DEFAULTS = {
  code: process.env.COMPANY_CODE || 'SMI',
  name: process.env.COMPANY_NAME || 'SRI MEENAKSHI INDUSTRIES',
  address: process.env.COMPANY_ADDRESS || 'Plot No. 297, 4th Main Road, Burma Colony, Perungudi, Chennai - 600 096.',
  cell: process.env.COMPANY_CELL || '94440 88604',
  email: process.env.COMPANY_EMAIL || 'srimeenakshiindustries001@gmail.com',
  web: process.env.COMPANY_WEB || 'srimeenakshigroups.in',
  gstin: process.env.COMPANY_GSTIN || '33IXGPS8286H1ZP',
  logoPath: '',
  active: true,
};

export {
  ensureUploadDirs,
  uploadsDir,
  logosDir,
  getLogoBuffer,
} from './logoStorage.js';

export function toPublicCompany(doc) {
  if (!doc) return null;
  const logoPath = doc.logoPath || '';
  return {
    id: doc._id?.toString?.() || doc.id || null,
    _id: doc._id?.toString?.() || doc.id || null,
    code: doc.code || '',
    name: doc.name || '',
    address: doc.address || '',
    cell: doc.cell || '',
    email: doc.email || '',
    web: doc.web || '',
    gstin: doc.gstin || '',
    logoPath,
    logoUrl: publicLogoUrl(logoPath),
    active: doc.active !== false,
  };
}

/** Ensure at least one company exists (migrates legacy singleton rows). */
export async function ensureDefaultCompany() {
  const count = await Company.countDocuments();
  if (count > 0) {
    // Backfill code on legacy docs
    await Company.updateMany(
      { $or: [{ code: { $exists: false } }, { code: null }, { code: '' }] },
      { $set: { code: ENV_DEFAULTS.code } },
    );
    return Company.findOne().sort({ createdAt: 1 });
  }
  return Company.create({ ...ENV_DEFAULTS });
}

export async function listCompanies({ activeOnly = false } = {}) {
  await ensureDefaultCompany();
  const filter = activeOnly ? { active: { $ne: false } } : {};
  const docs = await Company.find(filter).sort({ code: 1, name: 1 });
  return docs.map(toPublicCompany);
}

export async function getCompanyById(id) {
  if (!id) return null;
  const doc = await Company.findById(id);
  return toPublicCompany(doc);
}

/** @deprecated singleton helper — returns first/default company */
export async function getCompanyProfile() {
  const doc = await ensureDefaultCompany();
  return toPublicCompany(doc);
}

export function formatDisplayDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}
