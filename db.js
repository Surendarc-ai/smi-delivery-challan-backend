import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let connectPromise = null;

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectPromise) {
    connectPromise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 2,
      minPoolSize: 0,
      maxIdleTimeMS: 15000,
      serverSelectionTimeoutMS: 30000,
    }).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  await connectPromise;
  return mongoose.connection;
}
