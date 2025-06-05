const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// POST route for smart OCR
router.post('/smart-ocr', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Define the directory where processed files will be saved
    const processedDir = 'processed/';

    // Ensure consistent filename pattern across the application
    const outputFilename = `${path.basename(file.originalname, path.extname(file.originalname))}_ocr.pdf`;
    const outputPath = path.join(processedDir, outputFilename);

    // TODO: Add OCR processing logic here

    // Make sure we always use the same filename format when returning to client
    res.json({
      success: true,
      message: `Successfully processed ${file.originalname}`,
      file: outputFilename  // Use consistent filename
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;