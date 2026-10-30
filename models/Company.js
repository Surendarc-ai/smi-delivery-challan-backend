import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '', trim: true },
  cell: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  web: { type: String, default: '', trim: true },
  gstin: { type: String, default: '', trim: true },
  logoPath: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Company', companySchema);
