import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Delivery Challan API on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

start();
