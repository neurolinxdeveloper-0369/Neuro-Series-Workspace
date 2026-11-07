import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './modules/auth/auth.controller.js';
import { deviceRouter } from './modules/devices/device.controller.js';
import { homeRouter } from './modules/homes/home.controller.js';
import { homeService } from './modules/homes/home.service.js';

export const app = express();

// Initialize tables on boot
homeService.ensureTableExists().catch((err) => {
  console.error('Error verifying tables on boot:', err);
});

// Security & Parsing
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Express preflight
app.options('*', cors());

app.use(express.json());

// Health check endpoint
app.get(['/health', '/api/health', '/neuro-series/api/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Neuro Series Smart Workspace API',
  });
});

// API Routes - support multiple prefix variants for reverse proxy flexibility
app.use(['/neuro-series/api/auth', '/api/auth', '/auth'], authRouter);
app.use(['/neuro-series/api/devices', '/api/devices', '/devices'], deviceRouter);
app.use(['/neuro-series/api/homes', '/api/homes', '/homes'], homeRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});
