import { Router } from 'express';
import Customer from '../models/Customer.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = search
      ? {
          $or: [
            { name: new RegExp(search, 'i') },
            { gstin: new RegExp(search, 'i') },
            { phone: new RegExp(search, 'i') },
          ],
        }
      : {};

    const hasLimit = req.query.limit != null && req.query.limit !== '';
    if (hasLimit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
      const [items, total] = await Promise.all([
        Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
        Customer.countDocuments(filter),
      ]);
      return res.json({
        items,
        total,
        skip,
        limit,
        hasMore: skip + items.length < total,
      });
    }

    const customers = await Customer.find(filter).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, address, gstin, phone, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const customer = await Customer.create({
      name: name.trim(),
      address: address || '',
      gstin: gstin || '',
      phone: phone || '',
      email: email || '',
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    for (const key of ['name', 'address', 'gstin', 'phone', 'email']) {
      if (req.body[key] != null) updates[key] = req.body[key];
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
