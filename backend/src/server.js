import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports after dotenv is configured
const { router: twoFactorRoutes } = await import('./routes/twoFactor.js');
const { router: authRoutes } = await import('./routes/auth.js');
const { errorHandler } = await import('./middleware/errorHandler.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 2FA Backend running on http://localhost:${PORT}`);
  console.log(`📧 Gmail: ${process.env.GMAIL_USER}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});
