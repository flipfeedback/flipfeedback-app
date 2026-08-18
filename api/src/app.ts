import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './lib/config';
import { prisma } from './lib/prisma';
import { authRouter } from './routes/auth';
import { feedbackRouter } from './routes/feedback';
import { sourcesRouter } from './routes/sources';
import { labelsRouter } from './routes/labels';
import { teamRouter } from './routes/team';
import { analyticsRouter } from './routes/analytics';
import { errorHandler } from './middleware/errors';
import { requestId } from './middleware/requestId';

// Structured (JSON) access log line, one object per request, keyed by the
// per-request id so log aggregators can parse and correlate (FFSCRUM-20).
morgan.token('id', (req) => (req as Request).id ?? '-');
const jsonFormat: morgan.FormatFn<Request, Response> = (tokens, req, res) =>
  JSON.stringify({
    ts: tokens.date(req, res, 'iso'),
    reqId: tokens.id(req, res),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    responseTimeMs: Number(tokens['response-time'](req, res)),
  });

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  if (config.env !== 'test') {
    app.use(morgan(jsonFormat));
  }

  // Readiness probe: reflects database connectivity so orchestrators can pull a
  // pod out of rotation when its DB is unreachable (FFSCRUM-20). 200 when the DB
  // answers a trivial query, 503 otherwise.
  app.get('/health', async (_req, res) => {
    let db: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    const ok = db === 'up';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      service: 'flipfeedback-api',
      env: config.env,
      db,
    });
  });

  app.use('/auth', authRouter);
  app.use('/feedback', feedbackRouter);
  app.use('/sources', sourcesRouter);
  app.use('/labels', labelsRouter);
  app.use('/team', teamRouter);
  app.use('/analytics', analyticsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
