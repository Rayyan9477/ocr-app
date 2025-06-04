import express from 'express';
import path from 'path';
import ocrRouter from './api/ocr';
import logger from './lib/logger';

// Create Express application
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Use OCR router
app.use('/api', ocrRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
});

export default app;
