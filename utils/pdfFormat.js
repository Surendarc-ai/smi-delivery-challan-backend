import PdfFormat, {
  A4,
  BLOCK_IDS,
  DEFAULT_BLOCKS,
  PDF_FORMAT_DEFAULTS,
} from '../models/PdfFormat.js';

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeBlock(id, raw = {}) {
  const def = DEFAULT_BLOCKS[id] || { id, label: id, x: 40, y: 40, w: 100, h: 40, visible: true };
  return {
    id,
    label: String(raw.label || def.label),
    x: clamp(raw.x, 0, A4.width - 20, def.x),
    y: clamp(raw.y, 0, A4.height - 20, def.y),
    w: clamp(raw.w, 24, A4.width, def.w),
    h: clamp(raw.h, 16, A4.height, def.h),
    visible: raw.visible !== false,
  };
}

function normalizeBlocks(input) {
  const src = input?.blocks
    || (input instanceof Map ? Object.fromEntries(input) : null)
    || input
    || {};
  const plain = src instanceof Map ? Object.fromEntries(src) : src;
  const out = {};
  for (const id of BLOCK_IDS) {
    out[id] = normalizeBlock(id, plain[id] || DEFAULT_BLOCKS[id]);
  }
  return out;
}

export function normalizePdfFormat(doc = {}) {
  const blocksRaw = doc.blocks instanceof Map
    ? Object.fromEntries(doc.blocks)
    : (doc.blocks || DEFAULT_BLOCKS);
  return {
    titleText: String(doc.titleText || PDF_FORMAT_DEFAULTS.titleText).trim() || PDF_FORMAT_DEFAULTS.titleText,
    companyNameFontSize: clamp(doc.companyNameFontSize, 10, 28, PDF_FORMAT_DEFAULTS.companyNameFontSize),
    titleFontSize: clamp(doc.titleFontSize, 10, 24, PDF_FORMAT_DEFAULTS.titleFontSize),
    bodyFontSize: clamp(doc.bodyFontSize, 7, 14, PDF_FORMAT_DEFAULTS.bodyFontSize),
    itemFontSize: clamp(doc.itemFontSize, 6, 14, PDF_FORMAT_DEFAULTS.itemFontSize),
    itemNoteFontSize: clamp(doc.itemNoteFontSize, 5, 12, PDF_FORMAT_DEFAULTS.itemNoteFontSize),
    itemBold: Boolean(doc.itemBold),
    itemColumnLabel: String(doc.itemColumnLabel || PDF_FORMAT_DEFAULTS.itemColumnLabel).trim()
      || PDF_FORMAT_DEFAULTS.itemColumnLabel,
    qtyColumnLabel: String(doc.qtyColumnLabel || PDF_FORMAT_DEFAULTS.qtyColumnLabel).trim()
      || PDF_FORMAT_DEFAULTS.qtyColumnLabel,
    minEmptyRows: clamp(doc.minEmptyRows, 0, 20, PDF_FORMAT_DEFAULTS.minEmptyRows),
    receiverText: String(doc.receiverText || PDF_FORMAT_DEFAULTS.receiverText).trim()
      || PDF_FORMAT_DEFAULTS.receiverText,
    blocks: normalizeBlocks({ blocks: blocksRaw }),
  };
}

export async function getPdfFormat() {
  const existing = await PdfFormat.findOne().sort({ updatedAt: -1 });
  if (existing) return normalizePdfFormat(existing.toObject());
  const created = await PdfFormat.create({
    ...PDF_FORMAT_DEFAULTS,
    blocks: DEFAULT_BLOCKS,
  });
  return normalizePdfFormat(created.toObject());
}

export async function savePdfFormat(body) {
  const next = normalizePdfFormat(body);
  let doc = await PdfFormat.findOne().sort({ updatedAt: -1 });
  if (doc) {
    doc.titleText = next.titleText;
    doc.companyNameFontSize = next.companyNameFontSize;
    doc.titleFontSize = next.titleFontSize;
    doc.bodyFontSize = next.bodyFontSize;
    doc.itemFontSize = next.itemFontSize;
    doc.itemNoteFontSize = next.itemNoteFontSize;
    doc.itemBold = next.itemBold;
    doc.itemColumnLabel = next.itemColumnLabel;
    doc.qtyColumnLabel = next.qtyColumnLabel;
    doc.minEmptyRows = next.minEmptyRows;
    doc.receiverText = next.receiverText;
    doc.blocks = next.blocks;
    doc.markModified('blocks');
    await doc.save();
  } else {
    doc = await PdfFormat.create(next);
  }
  return normalizePdfFormat(doc.toObject());
}

export { A4, BLOCK_IDS, DEFAULT_BLOCKS, PDF_FORMAT_DEFAULTS };
