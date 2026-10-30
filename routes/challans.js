import { Router } from 'express';
import DeliveryChallan from '../models/DeliveryChallan.js';
import { authMiddleware } from '../middleware/auth.js';
import { buildChallanPdf } from '../utils/challanPdf.js';

const router = Router();
router.use(authMiddleware);

async function nextChallanNo() {
  const last = await DeliveryChallan.findOne().sort({ challanNo: -1 }).select('challanNo');
  return (last?.challanNo || 0) + 1;
}

function mapLineInput(l) {
  return {
    item: l.itemId || l.item || null,
    description: l.description,
    quantity: Number(l.quantity) || 0,
    unit: l.unit || 'Nos',
  };
}

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = search
      ? {
          $or: [
            ...(Number.isFinite(Number(search)) ? [{ challanNo: Number(search) }] : []),
            { partyDcNo: new RegExp(search, 'i') },
            { partyGstin: new RegExp(search, 'i') },
          ],
        }
      : {};

    const hasLimit = req.query.limit != null && req.query.limit !== '';
    if (hasLimit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
      const query = DeliveryChallan.find(filter)
        .populate('customer', 'name gstin phone address')
        .sort({ challanNo: -1 })
        .skip(skip)
        .limit(limit);
      const [items, total] = await Promise.all([
        query,
        DeliveryChallan.countDocuments(filter),
      ]);
      return res.json({
        items,
        total,
        skip,
        limit,
        hasMore: skip + items.length < total,
      });
    }

    const challans = await DeliveryChallan.find(filter)
      .populate('customer', 'name gstin phone address')
      .sort({ challanNo: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/next-number', async (_req, res) => {
  try {
    const challanNo = await nextChallanNo();
    res.json({ challanNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id)
      .populate('customer', 'name gstin phone address')
      .populate('lines.item', 'description hsnCode unit');
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      date, customer, partyDcNo, partyDcDate, partyGstin, lines, notes,
    } = req.body;

    if (!date || !customer) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    const no = await nextChallanNo();
    const challan = await DeliveryChallan.create({
      challanNo: no,
      date: new Date(date),
      customer,
      partyDcNo: partyDcNo || '',
      partyDcDate: partyDcDate ? new Date(partyDcDate) : null,
      partyGstin: partyGstin || '',
      lines: lines.map(mapLineInput),
      notes: notes || '',
      createdBy: req.userId,
    });

    const populated = await DeliveryChallan.findById(challan._id)
      .populate('customer', 'name gstin phone address')
      .populate('lines.item', 'description hsnCode unit');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    const fields = ['partyDcNo', 'partyGstin', 'notes'];
    for (const f of fields) {
      if (req.body[f] != null) updates[f] = req.body[f];
    }
    if (req.body.date) updates.date = new Date(req.body.date);
    if (req.body.partyDcDate !== undefined) {
      updates.partyDcDate = req.body.partyDcDate ? new Date(req.body.partyDcDate) : null;
    }
    if (req.body.customer) updates.customer = req.body.customer;
    if (Array.isArray(req.body.lines)) {
      updates.lines = req.body.lines.map(mapLineInput);
    }

    const challan = await DeliveryChallan.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('customer', 'name gstin phone address')
      .populate('lines.item', 'description hsnCode unit');
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const challan = await DeliveryChallan.findByIdAndDelete(req.params.id);
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id)
      .populate('customer', 'name gstin phone address')
      .populate('lines.item', 'description hsnCode unit');
    if (!challan) return res.status(404).json({ error: 'Challan not found' });

    const pdf = await buildChallanPdf(challan.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="delivery-challan-${challan.challanNo}.pdf"`,
    );
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
