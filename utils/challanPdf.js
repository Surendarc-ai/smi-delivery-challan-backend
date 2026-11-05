import PDFDocument from 'pdfkit';
import { formatDisplayDate, getCompanyById, getLogoBuffer, toPublicCompany } from './company.js';
import { formatChallanNo } from './challanNo.js';
import { getPdfFormat } from './pdfFormat.js';

function lineParts(line) {
  if (!line) return { primary: '', secondary: '' };
  const fromItem = (line.item && typeof line.item === 'object'
    ? line.item.description
    : '') || '';
  const itemName = String(fromItem || line.itemName || '').trim();
  const desc = String(line.description || '').trim();
  if (itemName) {
    const secondary = desc && desc !== itemName ? desc : '';
    return { primary: itemName, secondary };
  }
  return { primary: desc, secondary: '' };
}

function lineHsn(line) {
  if (!line) return '';
  const snap = String(line.hsnCode || '').trim();
  if (snap) return snap;
  if (line.item && typeof line.item === 'object') {
    return String(line.item.hsnCode || '').trim();
  }
  return '';
}

function lineRate(line) {
  const fromLine = Number(line?.rate);
  if (Number.isFinite(fromLine) && fromLine > 0) return fromLine;
  if (line?.item && typeof line.item === 'object') {
    const fromItem = Number(line.item.rate);
    if (Number.isFinite(fromItem) && fromItem > 0) return fromItem;
  }
  return Number.isFinite(fromLine) ? fromLine : 0;
}

function companyIdFromChallan(challan) {
  const ref = challan?.company;
  if (!ref) return null;
  if (typeof ref === 'object') return ref._id || ref.id || null;
  return ref;
}

function fmtNum(n, decimals = false) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  if (decimals || !Number.isInteger(v)) return v.toFixed(2);
  return String(v);
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawHLine(doc, x1, x2, y) {
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
}

function drawVLine(doc, x, y1, y2) {
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
}

export async function buildChallanPdf(challan) {
  const companyId = companyIdFromChallan(challan);
  let company = await getCompanyById(companyId);
  if (!company && challan.company && typeof challan.company === 'object' && challan.company.name) {
    company = toPublicCompany(challan.company);
  }
  if (!company) throw new Error('Company not found for this challan');

  const fmt = await getPdfFormat();
  const logoBuf = await getLogoBuffer(company.logoPath);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = 595.28;
    const pageH = 841.89;
    const m = 24;
    const left = m;
    const right = pageW - m;
    const width = right - left;
    const leftColW = Math.round(width * 0.55);
    const midX = left + leftColW;
    const body = fmt.bodyFontSize || 9;
    const small = Math.max(7, body - 1);

    const customer = challan.customer || {};
    const billAddress = String(customer.address || '').trim();
    const shipAddress = customer.shippingSameAsBilling === true
      ? billAddress
      : String(customer.shippingAddress || '').trim();
    const displayNo = formatChallanNo(company.code, challan.challanNo);
    const lines = Array.isArray(challan.lines) ? challan.lines : [];

    doc.lineWidth(1);

    // Single outer border for whole page content (drawn at end once we know height)
    const contentTop = m;
    let y = contentTop;
    const titleH = 22;
    doc.fontSize(fmt.titleFontSize || 12).font('Helvetica-Bold')
      .text(fmt.titleText || 'DELIVERY CHALLAN', left, y + 5, { width, align: 'center' });
    // Title cell border
    doc.rect(left, y, width, titleH).stroke();
    y += titleH;

    // Left stack + right meta share the same horizontal row heights
    const companyH = 70;
    const partyH = 56;
    const rowHs = [companyH, partyH, partyH];
    const leftStackH = rowHs.reduce((a, b) => a + b, 0);
    const headerTop = y;

    doc.rect(left, headerTop, leftColW, leftStackH).stroke();
    doc.rect(midX, headerTop, right - midX, leftStackH).stroke();

    // Full-width horizontals so left/right lines align
    let accY = headerTop;
    for (let i = 0; i < rowHs.length - 1; i += 1) {
      accY += rowHs[i];
      drawHLine(doc, left, right, accY);
    }

    // --- Company (logo + address + GSTIN + contact) ---
    const companyTop = headerTop;
    const logoSize = 26;
    const logoPad = 5;
    let textX = left + 6;
    let textY = companyTop + 4;
    if (logoBuf) {
      try {
        doc.image(logoBuf, left + logoPad, companyTop + logoPad, { fit: [logoSize, logoSize] });
        textX = left + logoPad + logoSize + 8;
      } catch (err) {
        console.error('PDF logo render failed:', err.message);
      }
    }
    const textW = midX - textX - 6;
    doc.fontSize(Math.min(fmt.companyNameFontSize || 11, 11)).font('Helvetica-Bold')
      .text(company.name || '', textX, textY, { width: textW, lineGap: 0 });
    textY = doc.y + 2;

    if (company.address) {
      doc.fontSize(7).font('Helvetica')
        .text(company.address, textX, textY, { width: textW, lineGap: 1 });
      textY = doc.y + 2;
    }
    if (company.gstin) {
      doc.fontSize(7).font('Helvetica-Bold')
        .text(`GSTIN: ${company.gstin}`, textX, textY, { width: textW, lineBreak: false });
      textY += 10;
    }
    const contactBits = [
      company.cell ? `Cell: ${company.cell}` : '',
      company.email ? `E-Mail: ${company.email}` : '',
    ].filter(Boolean).join(' | ');
    if (contactBits) {
      doc.fontSize(7).font('Helvetica')
        .text(contactBits, textX, textY, { width: textW, lineBreak: false });
    }

    // --- Consignee / Buyer ---
    function drawPartyBlock(top, h, title, name, address) {
      doc.fontSize(7).font('Helvetica').fillColor('#555555')
        .text(title, left + 6, top + 3, { width: leftColW - 12, lineBreak: false });
      doc.fillColor('#000000').fontSize(body).font('Helvetica-Bold')
        .text(name || '—', left + 6, top + 13, { width: leftColW - 12, lineBreak: false });
      if (address) {
        doc.fontSize(7).font('Helvetica')
          .text(address, left + 6, top + 25, { width: leftColW - 12, height: h - 28, lineGap: 0 });
      }
    }

    drawPartyBlock(
      companyTop + companyH,
      partyH,
      'Consignee (Ship to)',
      customer.name,
      shipAddress || billAddress,
    );
    drawPartyBlock(
      companyTop + companyH + partyH,
      partyH,
      'Buyer (Bill to)',
      customer.name,
      billAddress,
    );

    // --- Right meta (same row heights as left) ---
    const metaW = right - midX;
    const metaRows = [
      [['Challan No.', displayNo], ['Dated', formatDisplayDate(challan.date)]],
      [["Party's D.C. No.", challan.partyDcNo || ''], ['Party D.C. Date', challan.partyDcDate ? formatDisplayDate(challan.partyDcDate) : '']],
      [['', ''], ['Company Code', company.code || '']],
    ];
    const metaColW = metaW / 2;
    let metaY = headerTop;
    for (let r = 0; r < metaRows.length; r += 1) {
      const rowHMeta = rowHs[r];
      drawVLine(doc, midX + metaColW, metaY, metaY + rowHMeta);
      for (let c = 0; c < 2; c += 1) {
        const [label, value] = metaRows[r][c];
        const cx = midX + c * metaColW;
        if (!label && !value) continue;
        doc.fontSize(6.5).font('Helvetica').fillColor('#555555')
          .text(label, cx + 4, metaY + 4, { width: metaColW - 8, lineBreak: false });
        doc.fillColor('#000000').fontSize(small).font('Helvetica-Bold')
          .text(value || ' ', cx + 4, metaY + 15, { width: metaColW - 8, lineBreak: false });
      }
      metaY += rowHMeta;
    }

    y = headerTop + leftStackH;

    // Items table
    const colNoW = 26;
    const colHsnW = 52;
    const colQtyW = 44;
    const colRateW = 54;
    const colAmtW = 68;
    const colDescW = width - colNoW - colHsnW - colQtyW - colRateW - colAmtW;
    const cols = [
      { x: left, w: colNoW, label: 'Sl' },
      { x: left + colNoW, w: colDescW, label: 'Description of Goods' },
      { x: left + colNoW + colDescW, w: colHsnW, label: 'HSN' },
      { x: left + colNoW + colDescW + colHsnW, w: colQtyW, label: 'Qty' },
      { x: left + colNoW + colDescW + colHsnW + colQtyW, w: colRateW, label: 'Rate' },
      { x: left + colNoW + colDescW + colHsnW + colQtyW + colRateW, w: colAmtW, label: 'Amount' },
    ];

    const headerH2 = 18;
    const rowH = 18;
    const footerReserve = 100; // total + summary + authorised signature
    const minEmpty = Math.min(Number(fmt.minEmptyRows) || 6, 6);
    const minRows = Math.max(lines.length, minEmpty);
    const maxRows = Math.max(1, Math.floor((pageH - m - footerReserve - y - headerH2) / rowH));
    const rows = Math.min(minRows, maxRows);
    const tableH = headerH2 + rows * rowH;
    const tableTop = y;

    // Items: no cell borders — header labels + rows only
    doc.fontSize(7).font('Helvetica-Bold');
    for (const c of cols) {
      const alignRight = c.label === 'Qty' || c.label === 'Rate' || c.label === 'Amount';
      doc.text(c.label, c.x + 2, tableTop + 4, {
        width: c.w - 4,
        lineBreak: false,
        align: alignRight ? 'right' : 'left',
      });
    }
    drawHLine(doc, left, right, tableTop + headerH2);

    const itemFont = fmt.itemBold ? 'Helvetica-Bold' : 'Helvetica';
    let totalAmount = 0;

    for (let i = 0; i < rows; i += 1) {
      const rowY = tableTop + headerH2 + i * rowH;
      const line = lines[i];
      if (!line) continue;

      const { primary, secondary } = lineParts(line);
      const hsn = lineHsn(line);
      const qty = Number(line.quantity) || 0;
      const rate = lineRate(line);
      const amount = line.amount != null && line.amount !== '' && Number(line.amount) > 0
        ? Number(line.amount) || 0
        : Math.round(qty * rate * 100) / 100;
      totalAmount += amount;

      const numSize = 7;
      doc.fontSize(numSize).font('Helvetica').text(String(i + 1), cols[0].x + 2, rowY + 4, {
        width: cols[0].w - 4,
        lineBreak: false,
      });
      // Item name, then description on next line — no parentheses wrapping
      doc.fontSize(fmt.itemFontSize || 8).font(itemFont);
      doc.text(primary || '', cols[1].x + 2, rowY + 2, {
        width: cols[1].w - 4,
        lineBreak: false,
        ellipsis: true,
      });
      if (secondary) {
        doc.fontSize(fmt.itemNoteFontSize || 7).font('Helvetica')
          .text(secondary, cols[1].x + 2, rowY + 10, {
            width: cols[1].w - 4,
            lineBreak: false,
            ellipsis: true,
          });
      }
      doc.fontSize(numSize).font('Helvetica');
      doc.text(hsn, cols[2].x + 2, rowY + 4, { width: cols[2].w - 4, lineBreak: false });
      doc.text(fmtNum(qty), cols[3].x + 2, rowY + 4, { width: cols[3].w - 4, align: 'right' });
      doc.text(fmtNum(rate, true), cols[4].x + 2, rowY + 4, { width: cols[4].w - 4, align: 'right' });
      doc.text(fmtMoney(amount), cols[5].x + 2, rowY + 4, { width: cols[5].w - 4, align: 'right' });
    }

    y = tableTop + tableH;

    // Total (no CGST, no item cell borders)
    drawHLine(doc, left, right, y);
    const totalH = 20;
    doc.fontSize(body).font('Helvetica-Bold')
      .text('Total', cols[4].x - 30, y + 5, { width: cols[4].w + 28, align: 'right' });
    doc.text(fmtMoney(totalAmount), cols[5].x + 2, y + 5, {
      width: cols[5].w - 4,
      align: 'right',
    });
    y += totalH;
    drawHLine(doc, left, right, y);

    // Summary only (no amount-in-words)
    const notes = String(challan.notes || '').trim();
    if (notes) {
      const summaryH = 36;
      doc.rect(left, y, width, summaryH).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#555555')
        .text('Summary', left + 5, y + 4, { width: width - 10, lineBreak: false });
      doc.fillColor('#000000').fontSize(body).font('Helvetica')
        .text(notes, left + 5, y + 14, { width: width - 10, height: 18, ellipsis: true });
      y += summaryH;
    }

    // Authorised signature only
    const sigH = 64;
    doc.rect(left, y, width, sigH).stroke();
    doc.fontSize(body).font('Helvetica-Bold')
      .text(`For ${company.name}`, left + 8, y + 10, {
        width: width - 16,
        align: 'right',
      });
    doc.fontSize(8).font('Helvetica')
      .text('Authorised Signature', left + 8, y + sigH - 16, {
        width: width - 16,
        align: 'right',
      });
    y += sigH;

    // Outer border around full content block
    doc.rect(left, contentTop, width, y - contentTop).stroke();

    doc.fontSize(7).fillColor('#666666')
      .text('This is a Computer Generated Delivery Challan', left, y + 4, {
        width,
        align: 'center',
      });
    doc.fillColor('#000000');

    doc.end();
  });
}
