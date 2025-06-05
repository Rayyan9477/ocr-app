const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/download', (req, res) => {
  try {
    const filename = req.query.file;
    if (!filename) {
      return res.status(400).json({ error: 'No filename provided' });
    }
    
    // Check different filename patterns that might exist
    const processedDir = path.join(__dirname, '../../processed');
    let filePath = path.join(processedDir, filename);
    
    if (!fs.existsSync(filePath)) {
      // Try alternative naming patterns that might have been used
      const basename = path.basename(filename, path.extname(filename));
      const possibleFiles = fs.readdirSync(processedDir)
        .filter(file => file.includes(basename) && file.endsWith('_smart_ocr.pdf'));
      
      if (possibleFiles.length > 0) {
        filePath = path.join(processedDir, possibleFiles[0]);
      } else {
        console.error('File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
      }
    }
    
    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Error downloading file' });
  }
});

module.exports = router;