import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  itemName: { type: String, default: '', trim: true },
  description: { type: String, required: true, trim: true },
  hsnCode: { type: String, default: '', trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'Nos' },
}, { _id: false });

const deliveryChallanSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  challanNo: { type: Number, required: true },
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  partyDcNo: { type: String, default: '' },
  partyDcDate: { type: Date, default: null },
  partyGstin: { type: String, default: '' },
  lines: { type: [lineSchema], default: [] },
  notes: { type: String, default: '' },
  billed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

deliveryChallanSchema.index({ company: 1, challanNo: 1 }, { unique: true });

export default mongoose.model('DeliveryChallan', deliveryChallanSchema);
