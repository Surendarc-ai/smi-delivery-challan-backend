import PDFDocument from 'pdfkit';
import { formatDisplayDate, getCompanyProfile, getLogoBuffer } from './company.js';

export async function buildChallanPdf(challan) {
  const company = await getCompanyProfile();
  const logoBuffer = await getLogoBuffer(company.logoPath);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const left = 40;
    const right = pageWidth - 40;
    const contentWidth = right - left;

    const logoBox = 64;
    let textLeft = left;
    let headerTop = 40;

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, left, headerTop, {
          fit: [logoBox, logoBox],
          align: 'center',
          valign: 'center',
        });
        textLeft = left + logoBox + 14;
      } catch (err) {
        console.error('PDF logo render failed:', err.message);
      }
    }

    const textWidth = right - textLeft;
    doc.fontSize(16).font('Helvetica-Bold').text(company.name, textLeft, headerTop, {
      width: textWidth,
      align: logoBuffer ? 'left' : 'center',
    });
    doc.fontSize(9).font('Helvetica').text(company.address || '', {
      width: textWidth,
      align: logoBuffer ? 'left' : 'center',
    });
    doc.text(`Cell: ${company.cell}  |  E-mail: ${company.email}  |  Web: ${company.web}`, {
      width: textWidth,
      align: logoBuffer ? 'left' : 'center',
    });
    doc.font('Helvetica-Bold').text(`GSTIN: ${company.gstin}`, {
      width: textWidth,
      align: logoBuffer ? 'left' : 'center',
    });

    const afterHeader = Math.max(doc.y, headerTop + (logoBuffer ? logoBox : 0)) + 12;
    doc.y = afterHeader;

    doc.fontSize(14).font('Helvetica-Bold').text('DELIVERY CHALLAN', left, afterHeader, {
      width: contentWidth,
      align: 'center',
      underline: true,
    });

    const metaTop = doc.y + 16;
    const customer = challan.customer || {};

    doc.fontSize(10).font('Helvetica');
    doc.text('To', left, metaTop);
    doc.font('Helvetica-Bold').text('M/s', left + 24, metaTop);
    doc.font('Helvetica').text(customer.name || '—', left + 50, metaTop, { width: 250 });
    if (customer.address) {
      doc.text(customer.address, left + 50, metaTop + 14, { width: 250 });
    }

    const metaRightX = left + 340;
    doc.font('Helvetica-Bold').text('Date', metaRightX, metaTop);
    doc.font('Helvetica').text(formatDisplayDate(challan.date), metaRightX + 50, metaTop);
    doc.font('Helvetica-Bold').text('No.', metaRightX, metaTop + 16);
    doc.font('Helvetica').text(String(challan.challanNo), metaRightX + 50, metaTop + 16);

    doc.font('Helvetica-Bold').text('GSTIN', left, metaTop + 55);
    doc.font('Helvetica').text(challan.partyGstin || customer.gstin || '—', left + 50, metaTop + 55);

    const tableTop = metaTop + 80;
    const colNo = left;
    const colDesc = left + 50;
    const colQty = left + 430;
    const rowH = 24;

    doc.rect(left, tableTop, contentWidth, rowH).stroke();
    doc.font('Helvetica-Bold');
    doc.text('S.No.', colNo + 8, tableTop + 7);
    doc.text('DESCRIPTION', colDesc + 8, tableTop + 7);
    doc.text('Qty', colQty + 8, tableTop + 7);
    doc.moveTo(colDesc, tableTop).lineTo(colDesc, tableTop + rowH).stroke();
    doc.moveTo(colQty, tableTop).lineTo(colQty, tableTop + rowH).stroke();

    let y = tableTop + rowH;
    const lines = challan.lines?.length ? challan.lines : [{ description: '', quantity: '', unit: 'Nos' }];
    const minRows = Math.max(lines.length, 8);

    doc.font('Helvetica');
    for (let i = 0; i < minRows; i += 1) {
      const line = lines[i];
      doc.rect(left, y, contentWidth, rowH).stroke();
      doc.moveTo(colDesc, y).lineTo(colDesc, y + rowH).stroke();
      doc.moveTo(colQty, y).lineTo(colQty, y + rowH).stroke();

      if (line) {
        doc.text(String(i + 1), colNo + 8, y + 7);
        doc.text(line.description || '', colDesc + 8, y + 7, { width: 360 });
        const qtyText = line.quantity != null && line.quantity !== ''
          ? `${line.quantity} ${line.unit || 'Nos'}`
          : '';
        doc.text(qtyText, colQty + 8, y + 7, { width: 70 });
      }
      y += rowH;
    }

    const summary = String(challan.notes || '').trim();
    if (summary) {
      y += 16;
      doc.fontSize(10).font('Helvetica-Bold').text('Summary', left, y);
      y += 14;
      doc.font('Helvetica').text(summary, left, y, {
        width: contentWidth,
        align: 'left',
      });
      y = doc.y + 20;
    } else {
      y += 40;
    }

    doc.fontSize(10).font('Helvetica');
    doc.text('Received the goods in good conditions', left, y);
    doc.text(`For ${company.name}`, left + 300, y, { width: 200, align: 'right' });
    doc.text('Signature of the Receiver', left, y + 50);
    doc.text('Authorised Signature', left + 300, y + 50, { width: 200, align: 'right' });

    doc.end();
  });
}
