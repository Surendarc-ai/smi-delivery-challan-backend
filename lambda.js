import serverlessExpress from '@vendia/serverless-express';
import app from './app.js';
import { connectDB } from './db.js';

let serverlessHandler;
let initialized = false;

async function initialize() {
  if (initialized) return;
  await connectDB();
  initialized = true;
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await initialize();
  if (!serverlessHandler) {
    serverlessHandler = serverlessExpress({ app });
  }
  return serverlessHandler(event, context);
};
