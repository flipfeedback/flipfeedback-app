import { createApp } from './app';
import { config } from './lib/config';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`flipfeedback-api listening on port ${config.port} (${config.env})`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
