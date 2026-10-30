import { Router } from 'express';
import multer from 'multer';
import Company from '../models/Company.js';
import { authMiddleware } from '../middleware/auth.js';
import { getCompanyProfile } from '../utils/company.js';
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

router.get('/', async (_req, res) => {
  try {
    const company = await getCompanyProfile();
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', authMiddleware, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const fields = ['name', 'address', 'cell', 'email', 'web', 'gstin'];
      const updates = {};
      for (const key of fields) {
        if (req.body[key] != null) updates[key] = String(req.body[key]).trim();
      }

      if (req.body.name != null && !String(req.body.name).trim()) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      await getCompanyProfile();
      const company = await Company.findOne().sort({ updatedAt: -1 });
      if (!company) return res.status(500).json({ error: 'Company profile missing' });

      Object.assign(company, updates);

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
      const profile = await getCompanyProfile();
      res.json(profile);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

export default router;
