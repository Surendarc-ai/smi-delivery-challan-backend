import { Router } from 'express';
import DeliveryChallan from '../models/DeliveryChallan.js';
import Company from '../models/Company.js';
import { authMiddleware } from '../middleware/auth.js';
import { buildChallanPdf } from '../utils/challanPdf.js';
import { formatChallanNo } from '../utils/challanNo.js';
import { ensureDefaultCompany } from '../utils/company.js';

const router = Router();
router.use(authMiddleware);

let indexesReady = false;
async function ensureChallanIndexes() {
  if (indexesReady) return;
  try {
    await DeliveryChallan.collection.dropIndex('challanNo_1');
  } catch {
    /* index may not exist */
  }
  await DeliveryChallan.syncIndexes();
  indexesReady = true;
}

async function nextChallanNo(companyId) {
  const last = await DeliveryChallan.findOne({ company: companyId })
    .sort({ challanNo: -1 })
    .select('challanNo');
  return (last?.challanNo || 0) + 1;
}

async function resolveCompanyId(companyId) {
  if (companyId) {
    const c = await Company.findById(companyId);
    if (c) return c._id;
  }
  const fallback = await ensureDefaultCompany();
  return fallback._id;
}

async function backfillMissingCompany(companyId) {
  await DeliveryChallan.updateMany(
    { $or: [{ company: { $exists: false } }, { company: null }] },
    { $set: { company: companyId } },
  );
}

function mapLineInput(l) {
  const itemId = l.itemId || l.item || null;
  const itemName = String(l.itemName || '').trim();
  const description = String(l.description || '').trim();
  return {
    item: itemId || null,
    itemName,
    description: description || itemName || 'Item',
    hsnCode: String(l.hsnCode || '').trim(),
    quantity: Number(l.quantity) || 0,
    unit: l.unit || 'Nos',
  };
}

const companyPopulate = 'code name address cell email web gstin logoPath';
const customerPopulate = 'name gstin phone address shippingAddress shippingSameAsBilling';

router.use(async (_req, _res, next) => {
  try {
    await ensureChallanIndexes();
    const def = await ensureDefaultCompany();
    await backfillMissingCompany(def._id);
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const companyFilter = req.query.company || '';
    const filter = {};
    if (companyFilter) filter.company = companyFilter;
    if (search) {
      filter.$or = [
        ...(Number.isFinite(Number(search)) ? [{ challanNo: Number(search) }] : []),
        { partyDcNo: new RegExp(search, 'i') },
        { partyGstin: new RegExp(search, 'i') },
      ];
    }

    const hasLimit = req.query.limit != null && req.query.limit !== '';
    if (hasLimit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
      const query = DeliveryChallan.find(filter)
        .populate('company', companyPopulate)
        .populate('customer', customerPopulate)
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
      .populate('company', companyPopulate)
      .populate('customer', customerPopulate)
      .sort({ challanNo: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/next-number', async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.query.company);
    const challanNo = await nextChallanNo(companyId);
    res.json({ challanNo, company: companyId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id)
      .populate('company', companyPopulate)
      .populate('customer', customerPopulate)
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
      date, customer, company, partyDcNo, partyDcDate, partyGstin, lines, notes,
    } = req.body;

    if (!date || !customer) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!company) {
      return res.status(400).json({ error: 'Company is required' });
    }
    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    const companyId = await resolveCompanyId(company);
    const no = await nextChallanNo(companyId);
    const challan = await DeliveryChallan.create({
      company: companyId,
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
      .populate('company', companyPopulate)
      .populate('customer', customerPopulate)
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
    if (req.body.company) updates.company = await resolveCompanyId(req.body.company);
    if (typeof req.body.billed === 'boolean') updates.billed = req.body.billed;
    if (Array.isArray(req.body.lines)) {
      updates.lines = req.body.lines.map(mapLineInput);
    }

    const challan = await DeliveryChallan.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('company', companyPopulate)
      .populate('customer', customerPopulate)
      .populate('lines.item', 'description hsnCode unit');
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/billed', async (req, res) => {
  try {
    if (typeof req.body?.billed !== 'boolean') {
      return res.status(400).json({ error: 'billed must be true or false' });
    }
    const challan = await DeliveryChallan.findByIdAndUpdate(
      req.params.id,
      { billed: req.body.billed },
      { new: true },
    ).select('_id billed');
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
      .populate('company', companyPopulate)
      .populate('customer', customerPopulate)
      .populate('lines.item', 'description hsnCode unit')
      .lean();
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    if (!challan.company) {
      return res.status(400).json({ error: 'Challan has no company selected' });
    }

    const pdf = await buildChallanPdf(challan);
    const displayNo = formatChallanNo(challan.company?.code, challan.challanNo).replaceAll('/', '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="delivery-challan-${displayNo}.pdf"`,
    );
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
