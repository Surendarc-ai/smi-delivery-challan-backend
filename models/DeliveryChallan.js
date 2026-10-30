import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  /** Snapshot of catalog item name so PDF/UI still work if item is missing. */
  itemName: { type: String, default: '', trim: true },
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'Nos' },
}, { _id: false });

const deliveryChallanSchema = new mongoose.Schema({
  challanNo: { type: Number, required: true, unique: true },
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  partyDcNo: { type: String, default: '' },
  partyDcDate: { type: Date, default: null },
  partyGstin: { type: String, default: '' },
  lines: { type: [lineSchema], default: [] },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('DeliveryChallan', deliveryChallanSchema);
