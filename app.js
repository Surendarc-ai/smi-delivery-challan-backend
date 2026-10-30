import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import customersRoutes from './routes/customers.js';
import itemsRoutes from './routes/items.js';
import challansRoutes from './routes/challans.js';
import companyRoutes from './routes/company.js';
import pdfFormatRoutes from './routes/pdfFormat.js';
import reportsRoutes from './routes/reports.js';
import { ensureUploadDirs, getCompanyProfile, uploadsDir } from './utils/company.js';

ensureUploadDirs();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5175')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''));

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized) || /^https?:\/\/localhost(:\d+)?$/.test(normalized)) {
      return cb(null, origin);
    }
    return cb(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB error:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/challans', challansRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/pdf-format', pdfFormatRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', async (_, res) => {
  try {
    const company = await getCompanyProfile();
    res.json({ ok: true, company: company.name });
  } catch {
    res.json({ ok: true });
  }
});

export default app;
