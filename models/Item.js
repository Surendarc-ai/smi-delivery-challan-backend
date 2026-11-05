import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  hsnCode: { type: String, default: '', trim: true },
  unit: { type: String, default: 'Nos' },
  rate: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
