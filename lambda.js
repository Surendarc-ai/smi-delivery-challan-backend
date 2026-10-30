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
    serverlessHandler = serverlessExpress({
      app,
      // API Gateway corrupts binary unless base64-encoded.
      // Defaults only cover image/* — PDFs must be listed explicitly.
      binarySettings: {
        contentTypes: [
          'image/*',
          'application/pdf',
          'application/pdf*',
          'application/octet-stream',
        ],
      },
    });
  }
  return serverlessHandler(event, context);
};
