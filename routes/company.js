import { Router } from 'express';
import multer from 'multer';
import Company from '../models/Company.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  ensureDefaultCompany,
  getCompanyById,
  listCompanies,
  toPublicCompany,
} from '../utils/company.js';
import { deleteLogoFile, saveLogoFile } from '../utils/logoStorage.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error('Logo must be PNG, JPG, WEBP, or GIF'));
    }
    cb(null, true);
  },
});

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

router.get('/', async (req, res) => {
  try {
    const activeOnly = String(req.query.active || '') === '1';
    const companies = await listCompanies({ activeOnly });
    res.json({ items: companies, total: companies.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const company = await getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      await ensureDefaultCompany();
      const code = normalizeCode(req.body.code);
      const name = String(req.body.name || '').trim();
      if (!code) return res.status(400).json({ error: 'Company code is required' });
      if (!name) return res.status(400).json({ error: 'Company name is required' });

      const exists = await Company.findOne({ code });
      if (exists) return res.status(400).json({ error: 'Company code already exists' });

      const data = {
        code,
        name,
        address: String(req.body.address || '').trim(),
        cell: String(req.body.cell || '').trim(),
        email: String(req.body.email || '').trim(),
        web: String(req.body.web || '').trim(),
        gstin: String(req.body.gstin || '').trim(),
        active: String(req.body.active || 'true') !== 'false',
        logoPath: '',
      };

      if (req.file) {
        data.logoPath = await saveLogoFile({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
        });
      }

      const company = await Company.create(data);
      res.status(201).json(toPublicCompany(company));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

router.put('/:id', authMiddleware, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const company = await Company.findById(req.params.id);
      if (!company) return res.status(404).json({ error: 'Company not found' });

      if (req.body.code != null) {
        const code = normalizeCode(req.body.code);
        if (!code) return res.status(400).json({ error: 'Company code is required' });
        const clash = await Company.findOne({ code, _id: { $ne: company._id } });
        if (clash) return res.status(400).json({ error: 'Company code already exists' });
        company.code = code;
      }
      if (req.body.name != null) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ error: 'Company name is required' });
        company.name = name;
      }
      for (const key of ['address', 'cell', 'email', 'web', 'gstin']) {
        if (req.body[key] != null) company[key] = String(req.body[key]).trim();
      }
      if (req.body.active != null) {
        company.active = String(req.body.active) !== 'false';
      }

      if (req.file) {
        const prev = company.logoPath;
        company.logoPath = await saveLogoFile({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
        });
        if (prev) await deleteLogoFile(prev);
      }
      if (String(req.body.removeLogo || '') === 'true' && !req.file) {
        const prev = company.logoPath;
        company.logoPath = '';
        if (prev) await deleteLogoFile(prev);
      }

      await company.save();
      res.json(toPublicCompany(company));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const total = await Company.countDocuments();
    if (total <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only company' });
    }
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (company.logoPath) await deleteLogoFile(company.logoPath);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
