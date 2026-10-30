import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  shippingSameAsBilling: { type: Boolean, default: false },
  shippingAddress: { type: String, default: '' },
  gstin: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
