import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
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
