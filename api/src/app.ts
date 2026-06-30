import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './lib/config';
import { authRouter } from './routes/auth';
import { feedbackRouter } from './routes/feedback';
import { sourcesRouter } from './routes/sources';
import { labelsRouter } from './routes/labels';
import { teamRouter } from './routes/team';
import { analyticsRouter } from './routes/analytics';
import { errorHandler } from './middleware/errors';

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
  if (config.env !== 'test') {
    app.use(morgan('tiny'));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'flipfeedback-api', env: config.env });
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
