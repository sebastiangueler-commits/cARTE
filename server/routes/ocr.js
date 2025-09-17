const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `ocr-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// OCR processing function
async function processOCR(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      process.env.TESSERACT_LANG || 'eng',
      {
        logger: m => console.log(m)
      }
    );

    // Extract ISIN and quantity from text
    const isinRegex = /[A-Z]{2}[A-Z0-9]{10}/g;
    const quantityRegex = /(\d+(?:\.\d+)?)\s*(?:shares?|units?|pcs?|pieces?)/gi;
    const priceRegex = /(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:\.\d+)?)/g;

    const isins = text.match(isinRegex) || [];
    const quantities = text.match(quantityRegex) || [];
    const prices = text.match(priceRegex) || [];

    // Extract numeric values
    const extractedQuantities = quantities.map(q => {
      const match = q.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    }).filter(q => q !== null);

    const extractedPrices = prices.map(p => {
      const match = p.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    }).filter(p => p !== null);

    return {
      text,
      isins: [...new Set(isins)], // Remove duplicates
      quantities: extractedQuantities,
      prices: extractedPrices,
      confidence: 0.8 // Placeholder confidence score
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw new Error('Failed to process image with OCR');
  }
}

// Upload and process image with OCR
router.post('/process', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const imagePath = req.file.path;
    
    // Process OCR
    const ocrResult = await processOCR(imagePath);

    // Log OCR processing
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'ocr_process', { 
        filename: req.file.filename,
        isins_found: ocrResult.isins.length,
        quantities_found: ocrResult.quantities.length,
        prices_found: ocrResult.prices.length
      }]
    );

    res.json({
      message: 'OCR processing completed',
      imageUrl: `/uploads/${req.file.filename}`,
      ocrResult: {
        text: ocrResult.text,
        isins: ocrResult.isins,
        quantities: ocrResult.quantities,
        prices: ocrResult.prices,
        confidence: ocrResult.confidence
      }
    });
  } catch (error) {
    console.error('OCR upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Process OCR with manual text input (fallback)
router.post('/process-text', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'No text provided' });
    }

    // Extract ISIN and quantity from text
    const isinRegex = /[A-Z]{2}[A-Z0-9]{10}/g;
    const quantityRegex = /(\d+(?:\.\d+)?)\s*(?:shares?|units?|pcs?|pieces?)/gi;
    const priceRegex = /(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:\.\d+)?)/g;

    const isins = text.match(isinRegex) || [];
    const quantities = text.match(quantityRegex) || [];
    const prices = text.match(priceRegex) || [];

    // Extract numeric values
    const extractedQuantities = quantities.map(q => {
      const match = q.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    }).filter(q => q !== null);

    const extractedPrices = prices.map(p => {
      const match = p.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    }).filter(p => p !== null);

    // Log manual text processing
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'ocr_text_process', { 
        text_length: text.length,
        isins_found: isins.length,
        quantities_found: extractedQuantities.length,
        prices_found: extractedPrices.length
      }]
    );

    res.json({
      message: 'Text processing completed',
      ocrResult: {
        text,
        isins: [...new Set(isins)], // Remove duplicates
        quantities: extractedQuantities,
        prices: extractedPrices,
        confidence: 1.0 // Manual input has full confidence
      }
    });
  } catch (error) {
    console.error('OCR text processing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get OCR processing history for user
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT details, created_at
      FROM user_activity
      WHERE user_id = $1 AND action IN ('ocr_process', 'ocr_text_process')
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get OCR history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve uploaded images
router.get('/uploads/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;