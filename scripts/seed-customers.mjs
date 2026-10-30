import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Customer from '../models/Customer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsvPath = process.argv[2] || path.join(__dirname, 'customers.tsv');

const GSTIN_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b/i;
const PHONE_RE = /(?:PH\.?\s*NO\.?|PH\s*NO\.?|PHONE(?:\s*NO)?|MOB(?:ILE)?|CONTACT\s*NO)\s*[.:]?\s*([0-9][0-9\s\/-]{6,30})/i;

function cleanPhone(raw) {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim().replace(/[,.]$/, '');
}

function parseRow(line) {
  const parts = line.split('\t');
  if (parts.length < 2) return null;
  // sl, name, address, gstin (address/gstin may be missing)
  const name = (parts[1] || '').trim();
  if (!name || name === 'Particulars') return null;
  let address = (parts[2] || '').trim();
  let gstin = (parts[3] || '').trim();
  let phone = '';

  if (!gstin) {
    const m = address.match(GSTIN_RE);
    if (m) gstin = m[1].toUpperCase();
  } else {
    gstin = gstin.toUpperCase();
  }

  const pm = address.match(PHONE_RE);
  if (pm) phone = cleanPhone(pm[1]);

  return { name, address, gstin, phone, email: '' };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  const text = fs.readFileSync(tsvPath, 'utf8');
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map(parseRow)
    .filter(Boolean);

  console.log(`Parsed ${rows.length} customers from ${tsvPath}`);
  await mongoose.connect(uri);
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await Customer.findOne({ name: row.name });
    if (existing) {
      const patch = {};
      if (!existing.address && row.address) patch.address = row.address;
      if (!existing.gstin && row.gstin) patch.gstin = row.gstin;
      if (!existing.phone && row.phone) patch.phone = row.phone;
      if (Object.keys(patch).length) {
        await Customer.updateOne({ _id: existing._id }, { $set: patch });
        updated += 1;
      } else {
        skipped += 1;
      }
    } else {
      await Customer.create(row);
      inserted += 1;
    }
  }

  const total = await Customer.countDocuments();
  console.log(JSON.stringify({ inserted, updated, skipped, total }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
