import mongoose from 'mongoose';

/** A4 in PDF points (72 dpi): 595.28 × 841.89 */
export const A4 = { width: 595.28, height: 841.89 };

export const BLOCK_IDS = [
  'logo',
  'company',
  'title',
  'date',
  'challanNo',
  'billTo',
  'shipTo',
  'gstin',
  'itemsTable',
  'summary',
  'signatures',
];

export const DEFAULT_BLOCKS = {
  logo: { id: 'logo', label: 'Logo', x: 40, y: 40, w: 64, h: 64, visible: true },
  company: { id: 'company', label: 'Company header', x: 118, y: 40, w: 437, h: 70, visible: true },
  title: { id: 'title', label: 'Title', x: 40, y: 130, w: 515, h: 28, visible: true },
  date: { id: 'date', label: 'Date', x: 40, y: 170, w: 240, h: 18, visible: true },
  challanNo: { id: 'challanNo', label: 'Challan No.', x: 315, y: 170, w: 240, h: 18, visible: true },
  billTo: { id: 'billTo', label: 'Bill To', x: 40, y: 198, w: 250, h: 90, visible: true },
  shipTo: { id: 'shipTo', label: 'Ship To', x: 315, y: 198, w: 250, h: 90, visible: true },
  gstin: { id: 'gstin', label: 'GSTIN', x: 40, y: 300, w: 515, h: 18, visible: true },
  itemsTable: { id: 'itemsTable', label: 'Items table', x: 40, y: 330, w: 515, h: 280, visible: true },
  summary: { id: 'summary', label: 'Summary', x: 40, y: 620, w: 515, h: 60, visible: true },
  signatures: { id: 'signatures', label: 'Signatures', x: 40, y: 700, w: 515, h: 80, visible: true },
};

export const PDF_FORMAT_DEFAULTS = {
  titleText: 'DELIVERY CHALLAN',
  companyNameFontSize: 16,
  titleFontSize: 14,
  bodyFontSize: 10,
  itemFontSize: 9,
  itemNoteFontSize: 7,
  itemBold: false,
  itemColumnLabel: 'ITEM',
  qtyColumnLabel: 'Qty',
  minEmptyRows: 8,
  receiverText: 'Received the goods in good conditions',
  blocks: DEFAULT_BLOCKS,
};

const blockSchema = new mongoose.Schema({
  id: String,
  label: String,
  x: Number,
  y: Number,
  w: Number,
  h: Number,
  visible: { type: Boolean, default: true },
}, { _id: false });

const pdfFormatSchema = new mongoose.Schema({
  titleText: { type: String, default: PDF_FORMAT_DEFAULTS.titleText },
  companyNameFontSize: { type: Number, default: PDF_FORMAT_DEFAULTS.companyNameFontSize },
  titleFontSize: { type: Number, default: PDF_FORMAT_DEFAULTS.titleFontSize },
  bodyFontSize: { type: Number, default: PDF_FORMAT_DEFAULTS.bodyFontSize },
  itemFontSize: { type: Number, default: PDF_FORMAT_DEFAULTS.itemFontSize },
  itemNoteFontSize: { type: Number, default: PDF_FORMAT_DEFAULTS.itemNoteFontSize },
  itemBold: { type: Boolean, default: PDF_FORMAT_DEFAULTS.itemBold },
  itemColumnLabel: { type: String, default: PDF_FORMAT_DEFAULTS.itemColumnLabel },
  qtyColumnLabel: { type: String, default: PDF_FORMAT_DEFAULTS.qtyColumnLabel },
  minEmptyRows: { type: Number, default: PDF_FORMAT_DEFAULTS.minEmptyRows },
  receiverText: { type: String, default: PDF_FORMAT_DEFAULTS.receiverText },
  blocks: { type: Map, of: blockSchema, default: () => DEFAULT_BLOCKS },
}, { timestamps: true });

export default mongoose.model('PdfFormat', pdfFormatSchema);
