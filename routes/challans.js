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

router.get('/', async (req, res) => {
  try {
    const challans = await DeliveryChallan.find()
      .populate('customer', 'name gstin phone address')
      .sort({ challanNo: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id)
      .populate('customer', 'name gstin phone address');
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      date, customer, partyDcNo, partyDcDate, partyGstin, lines, notes, challanNo,
    } = req.body;

    if (!date || !customer) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    const no = challanNo ? Number(challanNo) : await nextChallanNo();
    const challan = await DeliveryChallan.create({
      challanNo: no,
      date: new Date(date),
      customer,
      partyDcNo: partyDcNo || '',
      partyDcDate: partyDcDate ? new Date(partyDcDate) : null,
      partyGstin: partyGstin || '',
      lines: lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unit: l.unit || 'Nos',
      })),
      notes: notes || '',
      createdBy: req.userId,
    });

    const populated = await DeliveryChallan.findById(challan._id)
      .populate('customer', 'name gstin phone address');
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
      updates.lines = req.body.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unit: l.unit || 'Nos',
      }));
    }

    const challan = await DeliveryChallan.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('customer', 'name gstin phone address');
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
      .populate('customer', 'name gstin phone address');
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
