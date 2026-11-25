import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import boardRoutes from './routes/boards.js';
import taskRoutes from './routes/tasks.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: [...config.clientOrigins], credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (config.env === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api', boardRoutes);
  app.use('/api', taskRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
