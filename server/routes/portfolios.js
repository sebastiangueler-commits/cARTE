const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all portfolios for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(a.id) as asset_count,
        COALESCE(SUM(a.quantity * COALESCE(a.current_price, a.purchase_price)), 0) as total_value,
        COALESCE(SUM(a.quantity * a.purchase_price), 0) as total_invested
      FROM portfolios p
      LEFT JOIN assets a ON p.id = a.portfolio_id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [req.user.id]);

    const portfolios = result.rows.map(portfolio => ({
      ...portfolio,
      total_value: parseFloat(portfolio.total_value),
      total_invested: parseFloat(portfolio.total_invested),
      asset_count: parseInt(portfolio.asset_count),
      daily_change: portfolio.total_value - portfolio.total_invested,
      daily_change_percent: portfolio.total_invested > 0 
        ? ((portfolio.total_value - portfolio.total_invested) / portfolio.total_invested) * 100 
        : 0
    }));

    res.json(portfolios);
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single portfolio by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get portfolio
    const portfolioResult = await pool.query(
      'SELECT * FROM portfolios WHERE id = $1',
      [id]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];

    // Check ownership
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get assets for this portfolio
    const assetsResult = await pool.query(`
      SELECT 
        a.*,
        (a.quantity * COALESCE(a.current_price, a.purchase_price)) as current_value,
        (a.quantity * a.purchase_price) as invested_value,
        CASE 
          WHEN a.current_price IS NOT NULL 
          THEN ((a.current_price - a.purchase_price) / a.purchase_price) * 100
          ELSE 0 
        END as price_change_percent
      FROM assets a
      WHERE a.portfolio_id = $1
      ORDER BY a.created_at DESC
    `, [id]);

    const assets = assetsResult.rows.map(asset => ({
      ...asset,
      current_value: parseFloat(asset.current_value),
      invested_value: parseFloat(asset.invested_value),
      price_change_percent: parseFloat(asset.price_change_percent)
    }));

    // Calculate portfolio totals
    const totalValue = assets.reduce((sum, asset) => sum + asset.current_value, 0);
    const totalInvested = assets.reduce((sum, asset) => sum + asset.invested_value, 0);
    const totalChange = totalValue - totalInvested;
    const totalChangePercent = totalInvested > 0 ? (totalChange / totalInvested) * 100 : 0;

    res.json({
      ...portfolio,
      assets,
      total_value: totalValue,
      total_invested: totalInvested,
      total_change: totalChange,
      total_change_percent: totalChangePercent,
      asset_count: assets.length
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new portfolio
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const result = await pool.query(
      'INSERT INTO portfolios (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, description || null]
    );

    const portfolio = result.rows[0];

    // Log portfolio creation
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'create_portfolio', { portfolio_id: portfolio.id, name: portfolio.name }]
    );

    res.status(201).json({
      message: 'Portfolio created successfully',
      portfolio: {
        ...portfolio,
        assets: [],
        total_value: 0,
        total_invested: 0,
        total_change: 0,
        total_change_percent: 0,
        asset_count: 0
      }
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update portfolio
router.put('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    // Check if portfolio exists and user owns it
    const portfolioResult = await pool.query(
      'SELECT * FROM portfolios WHERE id = $1',
      [id]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update portfolio
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE portfolios SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    // Log portfolio update
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'update_portfolio', { portfolio_id: id, fields: Object.keys(req.body) }]
    );

    res.json({
      message: 'Portfolio updated successfully',
      portfolio: result.rows[0]
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete portfolio
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if portfolio exists and user owns it
    const portfolioResult = await pool.query(
      'SELECT * FROM portfolios WHERE id = $1',
      [id]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete portfolio (cascade will delete assets)
    await pool.query('DELETE FROM portfolios WHERE id = $1', [id]);

    // Log portfolio deletion
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'delete_portfolio', { portfolio_id: id, name: portfolio.name }]
    );

    res.json({ message: 'Portfolio deleted successfully' });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;