import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import customersRoutes from './routes/customers.js';
import itemsRoutes from './routes/items.js';
import challansRoutes from './routes/challans.js';
import { getCompanyProfile } from './utils/company.js';

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

app.get('/api/health', (_, res) => res.json({ ok: true, company: getCompanyProfile().name }));
app.get('/api/company', (_, res) => res.json(getCompanyProfile()));

export default app;
