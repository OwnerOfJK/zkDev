import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import config from './config/env';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const port = config.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));