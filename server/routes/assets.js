const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all assets for a portfolio
router.get('/portfolio/:portfolioId', authenticateToken, async (req, res) => {
  try {
    const { portfolioId } = req.params;

    // Check if portfolio exists and user has access
    const portfolioResult = await pool.query(
      'SELECT user_id FROM portfolios WHERE id = $1',
      [portfolioId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get assets
    const result = await pool.query(`
      SELECT 
        a.*,
        (a.quantity * COALESCE(a.current_price, a.purchase_price)) as current_value,
        (a.quantity * a.purchase_price) as invested_value,
        CASE 
          WHEN a.current_price IS NOT NULL 
          THEN ((a.current_price - a.purchase_price) / a.purchase_price) * 100
          ELSE 0 
        END as price_change_percent,
        CASE 
          WHEN a.current_price IS NOT NULL 
          THEN (a.current_price - a.purchase_price) * a.quantity
          ELSE 0 
        END as total_change
      FROM assets a
      WHERE a.portfolio_id = $1
      ORDER BY a.created_at DESC
    `, [portfolioId]);

    const assets = result.rows.map(asset => ({
      ...asset,
      current_value: parseFloat(asset.current_value),
      invested_value: parseFloat(asset.invested_value),
      price_change_percent: parseFloat(asset.price_change_percent),
      total_change: parseFloat(asset.total_change)
    }));

    res.json(assets);
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single asset by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        a.*,
        p.user_id,
        (a.quantity * COALESCE(a.current_price, a.purchase_price)) as current_value,
        (a.quantity * a.purchase_price) as invested_value,
        CASE 
          WHEN a.current_price IS NOT NULL 
          THEN ((a.current_price - a.purchase_price) / a.purchase_price) * 100
          ELSE 0 
        END as price_change_percent
      FROM assets a
      JOIN portfolios p ON a.portfolio_id = p.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const asset = result.rows[0];

    // Check access
    if (asset.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      ...asset,
      current_value: parseFloat(asset.current_value),
      invested_value: parseFloat(asset.invested_value),
      price_change_percent: parseFloat(asset.price_change_percent)
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new asset
router.post('/', authenticateToken, [
  body('portfolioId').isInt(),
  body('symbol').trim().isLength({ min: 1, max: 50 }),
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('quantity').isFloat({ min: 0.000001 }),
  body('purchasePrice').isFloat({ min: 0 }),
  body('purchaseDate').isISO8601(),
  body('isin').optional().trim().isLength({ max: 20 }),
  body('notes').optional().trim(),
  body('imageUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      portfolioId,
      symbol,
      name,
      quantity,
      purchasePrice,
      purchaseDate,
      isin,
      notes,
      imageUrl
    } = req.body;

    // Check if portfolio exists and user has access
    const portfolioResult = await pool.query(
      'SELECT user_id FROM portfolios WHERE id = $1',
      [portfolioId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create asset
    const result = await pool.query(`
      INSERT INTO assets (
        portfolio_id, symbol, isin, name, quantity, purchase_price, 
        purchase_date, notes, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      portfolioId, symbol, isin || null, name, quantity, purchasePrice,
      purchaseDate, notes || null, imageUrl || null
    ]);

    const asset = result.rows[0];

    // Log asset creation
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'create_asset', { 
        asset_id: asset.id, 
        portfolio_id: portfolioId, 
        symbol: asset.symbol,
        name: asset.name 
      }]
    );

    res.status(201).json({
      message: 'Asset created successfully',
      asset: {
        ...asset,
        current_value: asset.quantity * asset.purchase_price,
        invested_value: asset.quantity * asset.purchase_price,
        price_change_percent: 0,
        total_change: 0
      }
    });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update asset
router.put('/:id', authenticateToken, [
  body('symbol').optional().trim().isLength({ min: 1, max: 50 }),
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('quantity').optional().isFloat({ min: 0.000001 }),
  body('purchasePrice').optional().isFloat({ min: 0 }),
  body('purchaseDate').optional().isISO8601(),
  body('isin').optional().trim().isLength({ max: 20 }),
  body('notes').optional().trim(),
  body('imageUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check if asset exists and user has access
    const assetResult = await pool.query(`
      SELECT a.*, p.user_id 
      FROM assets a
      JOIN portfolios p ON a.portfolio_id = p.id
      WHERE a.id = $1
    `, [id]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const asset = assetResult.rows[0];
    if (asset.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        const dbField = key === 'purchasePrice' ? 'purchase_price' :
                       key === 'purchaseDate' ? 'purchase_date' :
                       key === 'imageUrl' ? 'image_url' :
                       key === 'portfolioId' ? 'portfolio_id' : key;
        
        updateFields.push(`${dbField} = $${paramCount++}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE assets SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    // Log asset update
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'update_asset', { 
        asset_id: id, 
        portfolio_id: asset.portfolio_id,
        fields: Object.keys(updates) 
      }]
    );

    res.json({
      message: 'Asset updated successfully',
      asset: result.rows[0]
    });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete asset
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if asset exists and user has access
    const assetResult = await pool.query(`
      SELECT a.*, p.user_id 
      FROM assets a
      JOIN portfolios p ON a.portfolio_id = p.id
      WHERE a.id = $1
    `, [id]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const asset = assetResult.rows[0];
    if (asset.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete asset
    await pool.query('DELETE FROM assets WHERE id = $1', [id]);

    // Log asset deletion
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'delete_asset', { 
        asset_id: id, 
        portfolio_id: asset.portfolio_id,
        symbol: asset.symbol,
        name: asset.name 
      }]
    );

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;