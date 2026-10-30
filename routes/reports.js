import { Router } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import DeliveryChallan from '../models/DeliveryChallan.js';
import Item from '../models/Item.js';
import Company from '../models/Company.js';
import { authMiddleware } from '../middleware/auth.js';
import { formatChallanNo } from '../utils/challanNo.js';

const router = Router();
router.use(authMiddleware);

function parseDayStart(value) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDayEnd(value) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseItemIds(query) {
  const raw = query.itemIds ?? query.itemId ?? '';
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set(list)].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function buildItemReport(query) {
  const itemIds = parseItemIds(query);
  if (!itemIds.length) {
    const err = new Error('Select at least one item');
    err.status = 400;
    throw err;
  }

  const items = await Item.find({ _id: { $in: itemIds } }).lean();
  if (!items.length) {
    const err = new Error('Item not found');
    err.status = 404;
    throw err;
  }

  const itemOids = items.map((i) => i._id);
  const names = items.map((i) => String(i.description || '').trim()).filter(Boolean);

  const match = {
    $or: [
      { 'lines.item': { $in: itemOids } },
      ...(names.length
        ? [
            { 'lines.itemName': { $in: names } },
            { 'lines.description': { $in: names } },
          ]
        : []),
    ],
  };

  const companyId = String(query.company || '').trim();
  if (companyId) {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      const err = new Error('Invalid company');
      err.status = 400;
      throw err;
    }
    match.company = new mongoose.Types.ObjectId(companyId);
  }

  const from = parseDayStart(query.from);
  const to = parseDayEnd(query.to);
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }

  let companyMeta = null;
  if (companyId) {
    const c = await Company.findById(companyId).lean();
    if (c) companyMeta = { id: String(c._id), code: c.code, name: c.name };
  }

  const rows = await DeliveryChallan.aggregate([
    { $unwind: '$lines' },
    { $match: match },
    {
      $addFields: {
        lineItemName: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ['$lines.itemName', ''] } }, 0] },
            '$lines.itemName',
            '$lines.description',
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          itemName: '$lineItemName',
          customer: '$customer',
          company: '$company',
          challanNo: '$challanNo',
        },
        qty: { $sum: { $ifNull: ['$lines.quantity', 0] } },
        unit: { $first: { $ifNull: ['$lines.unit', 'Nos'] } },
      },
    },
    {
      $lookup: {
        from: 'customers',
        localField: '_id.customer',
        foreignField: '_id',
        as: 'customerDoc',
      },
    },
    { $unwind: { path: '$customerDoc', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'companies',
        localField: '_id.company',
        foreignField: '_id',
        as: 'companyDoc',
      },
    },
    { $unwind: { path: '$companyDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        customerId: '$_id.customer',
        customer: { $ifNull: ['$customerDoc.name', '—'] },
        itemName: '$_id.itemName',
        challanNo: '$_id.challanNo',
        companyCode: { $ifNull: ['$companyDoc.code', ''] },
        qty: 1,
        unit: 1,
      },
    },
    { $sort: { itemName: 1, customer: 1, challanNo: 1 } },
  ]);

  for (const row of rows) {
    row.dcNo = formatChallanNo(row.companyCode, row.challanNo);
    delete row.companyCode;
  }

  const totalQty = rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  return {
    items: items.map((i) => ({
      id: String(i._id),
      name: i.description,
      hsnCode: i.hsnCode || '',
      unit: i.unit || 'Nos',
    })),
    company: companyMeta,
    filters: {
      from: query.from || null,
      to: query.to || null,
      company: companyId || null,
      itemIds,
    },
    rows,
    totalQty,
  };
}

router.get('/by-item', async (req, res) => {
  try {
    const report = await buildItemReport(req.query);
    res.json(report);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/by-item/excel', async (req, res) => {
  try {
    const report = await buildItemReport(req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Delivery Challan';
    const sheet = workbook.addWorksheet('Item Report');

    sheet.columns = [
      { header: 'Item Name', key: 'itemName', width: 36 },
      { header: 'Customer', key: 'customer', width: 40 },
      { header: 'DC No', key: 'dcNo', width: 18 },
      { header: 'Qty', key: 'qty', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const row of report.rows) {
      sheet.addRow({
        itemName: row.itemName || '',
        customer: row.customer,
        dcNo: row.dcNo || '',
        qty: Number(row.qty) || 0,
        unit: row.unit || 'Nos',
      });
    }

    sheet.addRow({});
    sheet.addRow({
      itemName: 'Total',
      customer: '',
      dcNo: '',
      qty: report.totalQty,
      unit: '',
    }).font = { bold: true };

    const filename = `item-report.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
