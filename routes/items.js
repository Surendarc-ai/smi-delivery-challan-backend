import { Router } from 'express';
import Item from '../models/Item.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = search ? { description: new RegExp(search, 'i') } : {};
    const items = await Item.find(filter).sort({ description: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { description, unit } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const item = await Item.create({
      description: description.trim(),
      unit: unit || 'Nos',
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.description != null) updates.description = req.body.description;
    if (req.body.unit != null) updates.unit = req.body.unit;
    const item = await Item.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
