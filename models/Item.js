import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  unit: { type: String, default: 'Nos' },
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
