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

function block(fmt, id) {
  return fmt.blocks?.[id] || null;
}

function companyIdFromChallan(challan) {
  const ref = challan?.company;
  if (!ref) return null;
  if (typeof ref === 'object') {
    return ref._id || ref.id || null;
  }
  return ref;
}

export async function buildChallanPdf(challan) {
  // Always use the challan's selected company (name, address, logo, GSTIN, code).
  const companyId = companyIdFromChallan(challan);
  let company = await getCompanyById(companyId);
  if (!company && challan.company && typeof challan.company === 'object' && challan.company.name) {
    company = toPublicCompany(challan.company);
  }
  if (!company) {
    throw new Error('Company not found for this challan');
  }

  const fmt = await getPdfFormat();
  const logoBuf = await getLogoBuffer(company.logoPath);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const customer = challan.customer || {};
    const billAddress = String(customer.address || '').trim();
    const shipAddress = customer.shippingSameAsBilling === true
      ? billAddress
      : String(customer.shippingAddress || '').trim();
    const body = fmt.bodyFontSize;

    const logo = block(fmt, 'logo');
    if (logo?.visible && logoBuf) {
      try {
        doc.image(logoBuf, logo.x, logo.y, { fit: [logo.w, logo.h] });
      } catch (err) {
        console.error('PDF logo render failed:', err.message);
      }
    }

    const companyBlk = block(fmt, 'company');
    if (companyBlk?.visible) {
      doc.fontSize(fmt.companyNameFontSize).font('Helvetica-Bold')
        .text(company.name, companyBlk.x, companyBlk.y, { width: companyBlk.w });
      doc.fontSize(body - 1).font('Helvetica')
        .text(company.address || '', companyBlk.x, doc.y, { width: companyBlk.w });
      doc.text(`Cell: ${company.cell}  |  E-mail: ${company.email}  |  Web: ${company.web}`, {
        width: companyBlk.w,
      });
      doc.font('Helvetica-Bold').text(`GSTIN: ${company.gstin}`, { width: companyBlk.w });
    }

    const title = block(fmt, 'title');
    if (title?.visible) {
      doc.fontSize(fmt.titleFontSize).font('Helvetica-Bold')
        .text(fmt.titleText, title.x, title.y, { width: title.w, align: 'center', underline: true });
    }

    const dateBlk = block(fmt, 'date');
    if (dateBlk?.visible) {
      doc.fontSize(body).font('Helvetica-Bold').text('Date', dateBlk.x, dateBlk.y);
      doc.font('Helvetica').text(formatDisplayDate(challan.date), dateBlk.x + 40, dateBlk.y);
    }

    const noBlk = block(fmt, 'challanNo');
    if (noBlk?.visible) {
      const displayNo = formatChallanNo(company.code, challan.challanNo);
      doc.fontSize(body).font('Helvetica-Bold').text('No.', noBlk.x, noBlk.y);
      doc.font('Helvetica').text(displayNo, noBlk.x + 28, noBlk.y);
    }

    const bill = block(fmt, 'billTo');
    if (bill?.visible) {
      doc.fontSize(body).font('Helvetica-Bold').text('Bill To', bill.x, bill.y);
      doc.font('Helvetica-Bold').text('M/s', bill.x, bill.y + 14);
      doc.font('Helvetica').text(customer.name || '—', bill.x + 28, bill.y + 14, { width: bill.w - 28 });
      if (billAddress) {
        doc.text(billAddress, bill.x + 28, doc.y + 2, { width: bill.w - 28, height: bill.h - 32 });
      }
    }

    const ship = block(fmt, 'shipTo');
    if (ship?.visible) {
      doc.fontSize(body).font('Helvetica-Bold').text('Ship To', ship.x, ship.y);
      doc.font('Helvetica-Bold').text('M/s', ship.x, ship.y + 14);
      doc.font('Helvetica').text(customer.name || '—', ship.x + 28, ship.y + 14, { width: ship.w - 28 });
      // Only show ship address when set (or same-as-bill); never fall back to bill otherwise
      if (shipAddress) {
        doc.text(shipAddress, ship.x + 28, doc.y + 2, { width: ship.w - 28, height: ship.h - 32 });
      }
    }

    const gstin = block(fmt, 'gstin');
    if (gstin?.visible) {
      doc.fontSize(body).font('Helvetica-Bold').text('GSTIN', gstin.x, gstin.y);
      doc.font('Helvetica').text(challan.partyGstin || customer.gstin || '—', gstin.x + 50, gstin.y);
    }

    const table = block(fmt, 'itemsTable');
    if (table?.visible) {
      const hsnW = 72;
      const qtyW = 85;
      const colNo = table.x;
      const colDesc = table.x + 50;
      const colHsn = table.x + table.w - qtyW - hsnW;
      const colQty = table.x + table.w - qtyW;
      const headerH = 24;
      const rowH = 24;
      const lines = challan.lines?.length ? challan.lines : [];
      const minRows = Math.max(lines.length, fmt.minEmptyRows);
      const maxRows = Math.max(1, Math.floor((table.h - headerH) / rowH));
      const rows = Math.min(minRows, maxRows);
      const itemFont = fmt.itemBold ? 'Helvetica-Bold' : 'Helvetica';
      const descMaxW = Math.max(40, colHsn - colDesc - 12);

      doc.rect(table.x, table.y, table.w, headerH).stroke();
      doc.fontSize(body).font('Helvetica-Bold');
      doc.text('S.No.', colNo + 8, table.y + 7);
      doc.text(fmt.itemColumnLabel, colDesc + 8, table.y + 7);
      doc.text('HSN', colHsn + 6, table.y + 7);
      doc.text(fmt.qtyColumnLabel, colQty + 8, table.y + 7);
      doc.moveTo(colDesc, table.y).lineTo(colDesc, table.y + headerH).stroke();
      doc.moveTo(colHsn, table.y).lineTo(colHsn, table.y + headerH).stroke();
      doc.moveTo(colQty, table.y).lineTo(colQty, table.y + headerH).stroke();

      let y = table.y + headerH;
      for (let i = 0; i < rows; i += 1) {
        const line = lines[i];
        doc.rect(table.x, y, table.w, rowH).stroke();
        doc.moveTo(colDesc, y).lineTo(colDesc, y + rowH).stroke();
        doc.moveTo(colHsn, y).lineTo(colHsn, y + rowH).stroke();
        doc.moveTo(colQty, y).lineTo(colQty, y + rowH).stroke();

        if (line) {
          const { primary, secondary } = lineParts(line);
          const hsn = lineHsn(line);
          doc.fontSize(body).font('Helvetica').text(String(i + 1), colNo + 8, y + 7);
          doc.fontSize(fmt.itemFontSize).font(itemFont);
          const primaryW = Math.min(doc.widthOfString(primary || ''), descMaxW);
          doc.text(primary || '', colDesc + 8, y + 7, {
            width: descMaxW,
            lineBreak: false,
            ellipsis: true,
          });
          if (secondary) {
            doc.fontSize(fmt.itemNoteFontSize).font('Helvetica').fillColor('#555555')
              .text(` (${secondary})`, colDesc + 8 + primaryW, y + 8.5, {
                width: Math.max(20, descMaxW - primaryW),
                lineBreak: false,
                ellipsis: true,
              });
            doc.fillColor('#000000');
          }
          doc.fontSize(body).font('Helvetica').text(hsn, colHsn + 6, y + 7, {
            width: hsnW - 10,
            lineBreak: false,
          });
          const qtyText = line.quantity != null && line.quantity !== ''
            ? `${line.quantity} ${line.unit || 'Nos'}`
            : '';
          doc.fontSize(body).font('Helvetica').text(qtyText, colQty + 8, y + 7, { width: qtyW - 12 });
        }
        y += rowH;
      }
    }

    const summaryBlk = block(fmt, 'summary');
    const summary = String(challan.notes || '').trim();
    if (summaryBlk?.visible && summary) {
      doc.fontSize(body).font('Helvetica-Bold').text('Summary', summaryBlk.x, summaryBlk.y);
      doc.font('Helvetica').text(summary, summaryBlk.x, summaryBlk.y + 14, {
        width: summaryBlk.w,
        height: summaryBlk.h - 14,
      });
    }

    const sig = block(fmt, 'signatures');
    if (sig?.visible) {
      const mid = sig.x + sig.w / 2;
      doc.fontSize(body).font('Helvetica').text(fmt.receiverText, sig.x, sig.y, { width: sig.w / 2 - 10 });
      doc.text(`For ${company.name}`, mid, sig.y, { width: sig.w / 2, align: 'right' });
      doc.text('Signature of the Receiver', sig.x, sig.y + 50, { width: sig.w / 2 - 10 });
      doc.text('Authorised Signature', mid, sig.y + 50, { width: sig.w / 2, align: 'right' });
    }

    doc.end();
  });
}
