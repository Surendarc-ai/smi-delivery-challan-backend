import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getPdfFormat, savePdfFormat, PDF_FORMAT_DEFAULTS } from '../utils/pdfFormat.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const format = await getPdfFormat();
    res.json(format);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/defaults', (_req, res) => {
  res.json(JSON.parse(JSON.stringify(PDF_FORMAT_DEFAULTS)));
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const format = await savePdfFormat(req.body || {});
    res.json(format);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
