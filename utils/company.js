import Company from '../models/Company.js';
import { publicLogoUrl } from './logoStorage.js';

const ENV_DEFAULTS = {
  name: process.env.COMPANY_NAME || 'SRI MEENAKSHI INDUSTRIES',
  address: process.env.COMPANY_ADDRESS || 'Plot No. 297, 4th Main Road, Burma Colony, Perungudi, Chennai - 600 096.',
  cell: process.env.COMPANY_CELL || '94440 88604',
  email: process.env.COMPANY_EMAIL || 'srimeenakshiindustries001@gmail.com',
  web: process.env.COMPANY_WEB || 'srimeenakshigroups.in',
  gstin: process.env.COMPANY_GSTIN || '33IXGPS8286H1ZP',
  logoPath: '',
};

export {
  ensureUploadDirs,
  uploadsDir,
  logosDir,
  getLogoBuffer,
} from './logoStorage.js';

function toPublicProfile(doc) {
  const logoPath = doc.logoPath || '';
  return {
    id: doc._id?.toString?.() || doc.id || null,
    name: doc.name || ENV_DEFAULTS.name,
    address: doc.address || '',
    cell: doc.cell || '',
    email: doc.email || '',
    web: doc.web || '',
    gstin: doc.gstin || '',
    logoPath,
    logoUrl: publicLogoUrl(logoPath),
  };
}

export async function getCompanyProfile() {
  const existing = await Company.findOne().sort({ updatedAt: -1 });
  if (existing) return toPublicProfile(existing);

  const created = await Company.create({ ...ENV_DEFAULTS });
  return toPublicProfile(created);
}

export function formatDisplayDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}
