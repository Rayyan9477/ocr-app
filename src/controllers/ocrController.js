const ocrService = require('../services/ocrService');
const errorHandler = require('../utils/errorHandler');

async function processPdf(req, res) {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    try {
      const result = await ocrService.processDocument(file);
      return res.json(result);
    } catch (error) {
      const errorDetails = errorHandler.handleError(file.originalname, error);
      return res.status(500).json({
        error: 'OCR processing failed',
        details: errorDetails
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

module.exports = {
  processPdf,
};